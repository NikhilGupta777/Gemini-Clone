import asyncio
import base64
import json
import math
import os
import time
import threading
from collections import deque
from contextlib import asynccontextmanager

import numpy as np
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from backend.anomaly import AnomalyDetector
from backend.config import (
    OVERCROWDING_THRESHOLD, RUNNING_SPEED_THRESHOLD,
    UNATTENDED_OBJECT_TIME, STATIONARY_THRESHOLD, COCO_CLASSES,
)
from backend.detector import _download_model, is_model_ready, get_model_error

# ─── Global State ─────────────────────────────────────────────────────────────

alert_history: deque = deque(maxlen=500)
connected_clients: list[WebSocket] = []

current_config = {
    "overcrowding_threshold": OVERCROWDING_THRESHOLD,
    "running_speed_threshold": RUNNING_SPEED_THRESHOLD,
    "unattended_object_time": UNATTENDED_OBJECT_TIME,
    "stationary_threshold": STATIONARY_THRESHOLD,
}

stats_snapshot = {
    "person_count": 0,
    "object_count": 0,
    "anomaly_count": 0,
    "fps": 0,
    "uptime_seconds": 0,
}

_start_time = time.time()
_frame_times: deque = deque(maxlen=30)
_alert_cooldowns: dict = {}
_ALERT_COOLDOWN_SECS = 5.0
_alert_id_counter = 0

# ─── Processing mode state ────────────────────────────────────────────────────
# Modes: "idle" | "video" | "webcam" | "stream"

VIDEO_UPLOAD_PATH = "/tmp/crowdlens_upload.mp4"
_processing_mode = "idle"
_active_task: asyncio.Task | None = None
_video_anomaly_detector = AnomalyDetector()

video_status = {
    "mode": "idle",
    "filename": None,
    "progress": 0.0,
    "total_frames": 0,
    "current_frame": 0,
    "model_ready": False,
    "model_error": None,
    "error": None,
}

stream_status = {
    "active": False,
    "url": None,
    "error": None,
}

webcam_status = {
    "active": False,
    "error": None,
}

# Shared queue for webcam frames arriving over WebSocket
_cam_frame_queue: asyncio.Queue = asyncio.Queue(maxsize=4)


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _get_zone(cx: float) -> str:
    from backend.config import FRAME_WIDTH
    if cx < FRAME_WIDTH / 3:
        return "A"
    if cx < 2 * FRAME_WIDTH / 3:
        return "B"
    return "C"


def _should_record_alert(anomaly: dict, now: float) -> bool:
    key = (anomaly.get("type"), anomaly.get("track_id"))
    if now - _alert_cooldowns.get(key, 0) >= _ALERT_COOLDOWN_SECS:
        _alert_cooldowns[key] = now
        return True
    return False


def build_frame_payload(tracks: list, anomalies: list, now: float, mode: str | None = None) -> dict:
    person_count = sum(1 for t in tracks if t["class_id"] == 0)
    object_count = sum(1 for t in tracks if t["class_id"] != 0)

    _frame_times.append(now)
    fps = 0
    if len(_frame_times) >= 2:
        elapsed = _frame_times[-1] - _frame_times[0]
        fps = round((len(_frame_times) - 1) / elapsed) if elapsed > 0 else 0

    stats_snapshot.update({
        "person_count": person_count,
        "object_count": object_count,
        "anomaly_count": len(anomalies),
        "fps": fps,
        "uptime_seconds": round(now - _start_time),
    })

    serializable_anomalies = []
    for a in anomalies:
        sa = dict(a)
        if sa.get("position") is not None:
            pos = sa["position"]
            sa["position"] = [float(pos[0]), float(pos[1])]
        serializable_anomalies.append(sa)

    global _alert_id_counter
    effective_mode = mode or _processing_mode
    for a in serializable_anomalies:
        if _should_record_alert(a, now):
            _alert_id_counter += 1
            alert_history.append({
                "id": _alert_id_counter,
                "anomaly": a,
                "timestamp": now,
                "iso": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(now)),
                "source": effective_mode,
            })

    return {
        "tracks": tracks,
        "anomalies": serializable_anomalies,
        "stats": stats_snapshot.copy(),
        "timestamp": now,
        "mode": effective_mode,
    }


def _apply_config():
    import backend.config as cfg
    import backend.anomaly as am
    for k, v in current_config.items():
        setattr(cfg, k.upper(), v)
        setattr(am, k.upper(), v)


async def _broadcast(message: str):
    dead = []
    for ws in connected_clients:
        try:
            await ws.send_text(message)
        except Exception:
            dead.append(ws)
    for d in dead:
        if d in connected_clients:
            connected_clients.remove(d)


def _cancel_active():
    global _active_task
    if _active_task and not _active_task.done():
        _active_task.cancel()
        _active_task = None


def _build_tracks_from_yolo(raw_tracks: list) -> list:
    tracks = []
    for t in raw_tracks:
        x1, y1, x2, y2 = [max(0, int(v)) for v in t["bbox"]]
        cx = (x1 + x2) / 2
        tracks.append({
            "id": t["id"],
            "x1": x1, "y1": y1, "x2": x2, "y2": y2,
            "class_id": t["class_id"],
            "class_name": COCO_CLASSES.get(t["class_id"], "object"),
            "running": False,
            "confidence": round(t.get("confidence", 0), 2),
            "zone": _get_zone(cx),
        })
    return tracks


def _finalize_tracks(tracks: list, anomalies: list) -> list:
    running_ids = {a.get("track_id") for a in anomalies if a["type"] == "running"}
    for t in tracks:
        t["running"] = t["id"] in running_ids
    return tracks


def _encode_preview(frame) -> str:
    """Encode a cv2 frame as a compact base64 JPEG for WebSocket transmission."""
    import cv2
    preview = cv2.resize(frame, (640, 360))
    _, buf = cv2.imencode(".jpg", preview, [cv2.IMWRITE_JPEG_QUALITY, 55])
    return base64.b64encode(buf.tobytes()).decode("ascii")


# ─── Video processing loop ────────────────────────────────────────────────────

async def video_processing_loop():
    global _video_anomaly_detector
    import cv2

    video_status["error"] = None

    try:
        from backend.detector import YOLOv8Detector
        from backend.sort_tracker import Sort
    except Exception as e:
        video_status["error"] = f"Failed to load detector: {e}"
        return

    try:
        detector = YOLOv8Detector()
        tracker = Sort(max_age=3, min_hits=2, iou_threshold=0.3)
        _video_anomaly_detector = AnomalyDetector()
    except Exception as e:
        video_status["error"] = f"Detector init failed: {e}"
        return

    cap = cv2.VideoCapture(VIDEO_UPLOAD_PATH)
    if not cap.isOpened():
        video_status["error"] = "Could not open video file"
        return

    total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    video_status["total_frames"] = total
    frame_num = 0

    try:
        while True:
            ret, frame = cap.read()
            if not ret:
                cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
                frame_num = 0
                tracker.reset()
                _video_anomaly_detector = AnomalyDetector()
                continue

            frame_num += 1
            video_status["current_frame"] = frame_num
            video_status["progress"] = round((frame_num / total * 100), 1) if total > 0 else 0

            frame = cv2.resize(frame, (1280, 720))
            detections = detector.detect(frame)
            raw_tracks = tracker.update(detections)

            now = time.time()
            _apply_config()
            tracks = _build_tracks_from_yolo(raw_tracks)
            anomalies = _video_anomaly_detector.update(tracks, now)
            tracks = _finalize_tracks(tracks, anomalies)

            payload = build_frame_payload(tracks, anomalies, now, "video")
            payload["frame_jpeg"] = _encode_preview(frame)
            if connected_clients:
                await _broadcast(json.dumps(payload))

            await asyncio.sleep(0.04)

    except asyncio.CancelledError:
        pass
    finally:
        cap.release()
        video_status["progress"] = 0


# ─── Stream processing loop (RTSP / HTTP / IP camera) ─────────────────────────

async def stream_processing_loop(url: str):
    """Use an FFmpeg subprocess to pipe raw BGR frames.

    Advantages over cv2.VideoCapture(url):
    - Handles HTTP MP4 progressive downloads correctly (loops when finished)
    - Works for MJPEG HTTP streams, HLS, and most container formats
    - Gives readable stderr so we can surface a clear error for blocked ports
    """
    global _video_anomaly_detector
    import subprocess

    W, H = 1280, 720
    FRAME_BYTES = W * H * 3

    stream_status["error"] = None
    stream_status["active"] = True

    try:
        from backend.detector import YOLOv8Detector
        from backend.sort_tracker import Sort
    except Exception as e:
        stream_status["error"] = f"Failed to load detector: {e}"
        stream_status["active"] = False
        return

    try:
        detector = YOLOv8Detector()
        tracker = Sort(max_age=5, min_hits=2, iou_threshold=0.3)
        _video_anomaly_detector = AnomalyDetector()
    except Exception as e:
        stream_status["error"] = f"Detector init failed: {e}"
        stream_status["active"] = False
        return

    import tempfile, os as _os

    # Write FFmpeg stderr to a temp file to avoid pipe deadlock
    # (stderr fills the 64 KB pipe buffer → FFmpeg blocks → stdout stalls)
    _stderr_path = tempfile.mktemp(suffix=".ffmpeg_err.txt")

    def _build_cmd() -> list[str]:
        cmd = ["ffmpeg", "-y", "-loglevel", "error"]
        if url.lower().startswith("rtsp://"):
            cmd += ["-rtsp_transport", "tcp"]
        cmd += [
            "-i", url,
            "-f", "rawvideo",
            "-pix_fmt", "bgr24",
            "-vf", f"scale={W}:{H}",
            "-",
        ]
        return cmd

    def _start_proc():
        stderr_fh = open(_stderr_path, "wb")
        # bufsize=-1 (default) wraps stdout in BufferedReader so that
        # read(n) returns EXACTLY n bytes — raw FileIO only returns
        # whatever is available in a single syscall, causing premature EOF.
        return subprocess.Popen(
            _build_cmd(),
            stdout=subprocess.PIPE,
            stderr=stderr_fh,
        )

    def _read_exactly(pipe, n: int) -> bytes:
        """Read exactly n bytes from pipe, or fewer if the pipe closes."""
        buf = bytearray()
        while len(buf) < n:
            chunk = pipe.read(n - len(buf))
            if not chunk:
                break
            buf.extend(chunk)
        return bytes(buf)

    def _read_stderr() -> str:
        try:
            with open(_stderr_path, "r", errors="replace") as fh:
                return fh.read()
        except Exception:
            return ""

    loop = asyncio.get_event_loop()
    proc = None

    try:
        proc = await loop.run_in_executor(None, _start_proc)
        print(f"[stream] FFmpeg opened: {url}")
        frames_read = 0

        while True:
            raw = await loop.run_in_executor(None, _read_exactly, proc.stdout, FRAME_BYTES)

            if len(raw) < FRAME_BYTES:
                # FFmpeg exited — read stderr from temp file for diagnostics
                proc.kill()
                proc.wait()
                stderr_str = _read_stderr()

                if frames_read == 0:
                    # Never decoded a single frame — real connection error
                    low = stderr_str.lower()
                    if "403" in stderr_str or "forbidden" in low or "connection refused" in low:
                        stream_status["error"] = (
                            "Connection refused — RTSP port 554 is blocked in this "
                            "environment. Use an HTTP/MJPEG stream URL instead."
                        )
                    else:
                        last_line = stderr_str.strip().split("\n")[-1] if stderr_str.strip() else ""
                        stream_status["error"] = last_line[:250] or f"Could not open stream: {url}"
                    break

                # Had frames — finite video (e.g. HTTP MP4) ended; loop it
                print(f"[stream] Video ended after {frames_read} frames — looping")
                tracker = Sort(max_age=5, min_hits=2, iou_threshold=0.3)
                _video_anomaly_detector = AnomalyDetector()
                frames_read = 0
                proc = await loop.run_in_executor(None, _start_proc)
                continue

            frames_read += 1
            frame = np.frombuffer(raw, dtype=np.uint8).reshape((H, W, 3)).copy()
            detections = await loop.run_in_executor(None, detector.detect, frame)
            raw_tracks = tracker.update(detections)

            now = time.time()
            _apply_config()
            tracks = _build_tracks_from_yolo(raw_tracks)
            anomalies = _video_anomaly_detector.update(tracks, now)
            tracks = _finalize_tracks(tracks, anomalies)

            payload = build_frame_payload(tracks, anomalies, now, "stream")
            payload["frame_jpeg"] = _encode_preview(frame)
            if connected_clients:
                await _broadcast(json.dumps(payload))

            await asyncio.sleep(0.04)

    except asyncio.CancelledError:
        pass
    finally:
        if proc and proc.poll() is None:
            proc.kill()
            proc.wait()
        try:
            _os.unlink(_stderr_path)
        except Exception:
            pass
        stream_status["active"] = False
        stream_status["url"] = None
        print("[stream] Stream processing stopped")


# ─── Webcam frame processing loop ─────────────────────────────────────────────

async def webcam_processing_loop():
    """Pulls JPEG frames from _cam_frame_queue, runs YOLO+SORT, broadcasts."""
    global _video_anomaly_detector
    import cv2

    webcam_status["error"] = None
    webcam_status["active"] = True

    try:
        from backend.detector import YOLOv8Detector
        from backend.sort_tracker import Sort
    except Exception as e:
        webcam_status["error"] = f"Failed to load detector: {e}"
        webcam_status["active"] = False
        print(f"[webcam] Failed to load detector: {e}")
        return

    try:
        detector = YOLOv8Detector()
        tracker = Sort(max_age=3, min_hits=2, iou_threshold=0.3)
        anomaly_detector = AnomalyDetector()
    except Exception as e:
        webcam_status["error"] = f"Detector init failed: {e}"
        webcam_status["active"] = False
        print(f"[webcam] Detector init failed: {e}")
        return

    print("[webcam] Webcam processing loop started")

    try:
        while True:
            try:
                jpeg_bytes = await asyncio.wait_for(_cam_frame_queue.get(), timeout=5.0)
            except asyncio.TimeoutError:
                # Keep waiting if still in webcam mode
                if _processing_mode == "webcam":
                    continue
                break

            if _processing_mode != "webcam":
                break

            arr = np.frombuffer(jpeg_bytes, dtype=np.uint8)
            frame = cv2.imdecode(arr, cv2.IMREAD_COLOR)
            if frame is None:
                continue

            frame = cv2.resize(frame, (1280, 720))
            detections = detector.detect(frame)
            raw_tracks = tracker.update(detections)

            now = time.time()
            _apply_config()
            tracks = _build_tracks_from_yolo(raw_tracks)
            anomalies = anomaly_detector.update(tracks, now)
            tracks = _finalize_tracks(tracks, anomalies)

            payload = build_frame_payload(tracks, anomalies, now, "webcam")
            payload["frame_jpeg"] = _encode_preview(frame)
            if connected_clients:
                await _broadcast(json.dumps(payload))

    except asyncio.CancelledError:
        pass
    finally:
        webcam_status["active"] = False
        print("[webcam] Webcam processing loop stopped")


# ─── Lifespan ─────────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    thread = threading.Thread(target=_download_model, daemon=True)
    thread.start()
    yield
    _cancel_active()


# ─── App ──────────────────────────────────────────────────────────────────────

app = FastAPI(title="CrowdLens API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─── REST Endpoints ───────────────────────────────────────────────────────────

@app.get("/api/health")
def health():
    return {"status": "ok", "uptime": round(time.time() - _start_time)}


@app.get("/api/stats")
def get_stats():
    return stats_snapshot


@app.get("/api/alerts/history")
def get_alert_history(limit: int = 200):
    history = list(alert_history)
    history.reverse()
    return {"alerts": history[:limit], "total": len(history)}


@app.get("/api/config")
def get_config():
    return current_config


class ConfigUpdate(BaseModel):
    overcrowding_threshold: int | None = None
    running_speed_threshold: float | None = None
    unattended_object_time: float | None = None
    stationary_threshold: float | None = None


@app.put("/api/config")
def update_config(body: ConfigUpdate):
    if body.overcrowding_threshold is not None:
        current_config["overcrowding_threshold"] = body.overcrowding_threshold
    if body.running_speed_threshold is not None:
        current_config["running_speed_threshold"] = body.running_speed_threshold
    if body.unattended_object_time is not None:
        current_config["unattended_object_time"] = body.unattended_object_time
    if body.stationary_threshold is not None:
        current_config["stationary_threshold"] = body.stationary_threshold
    return current_config


# ─── Video endpoints ──────────────────────────────────────────────────────────

@app.post("/api/video/upload")
async def upload_video(file: UploadFile = File(...)):
    if not file.filename:
        raise HTTPException(400, "No file provided")
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in {".mp4", ".avi", ".mov", ".mkv", ".webm"}:
        raise HTTPException(400, "Unsupported video format")

    content = await file.read()
    if len(content) > 500 * 1024 * 1024:
        raise HTTPException(400, "File too large (max 500 MB)")

    with open(VIDEO_UPLOAD_PATH, "wb") as f:
        f.write(content)

    video_status["filename"] = file.filename
    video_status["mode"] = "ready"
    video_status["progress"] = 0
    return {"success": True, "filename": file.filename, "size_mb": round(len(content) / 1e6, 1)}


@app.post("/api/video/start")
async def start_video():
    global _processing_mode, _active_task
    if not os.path.exists(VIDEO_UPLOAD_PATH):
        raise HTTPException(400, "No video uploaded yet")
    if not is_model_ready():
        raise HTTPException(503, "YOLOv8n model is still loading, please wait")

    _cancel_active()
    _processing_mode = "video"
    video_status["mode"] = "processing"
    _active_task = asyncio.create_task(video_processing_loop())
    return {"success": True}


@app.post("/api/video/stop")
async def stop_video():
    global _processing_mode
    _cancel_active()
    _processing_mode = "idle"
    video_status["mode"] = "ready"
    video_status["progress"] = 0
    return {"success": True}


@app.get("/api/video/status")
def get_video_status():
    return {
        **video_status,
        "model_ready": is_model_ready(),
        "model_error": get_model_error(),
    }


# ─── Stream endpoints ─────────────────────────────────────────────────────────

class StreamRequest(BaseModel):
    url: str


@app.post("/api/stream/start")
async def start_stream(body: StreamRequest):
    global _processing_mode, _active_task
    if not is_model_ready():
        raise HTTPException(503, "YOLOv8n model not ready yet — please wait")
    if not body.url.strip():
        raise HTTPException(400, "Stream URL is required")

    _cancel_active()
    _processing_mode = "stream"
    stream_status["url"] = body.url.strip()
    stream_status["error"] = None
    _active_task = asyncio.create_task(stream_processing_loop(body.url.strip()))
    return {"success": True}


@app.post("/api/stream/stop")
async def stop_stream():
    global _processing_mode
    _cancel_active()
    _processing_mode = "idle"
    stream_status["active"] = False
    stream_status["url"] = None
    return {"success": True}


@app.get("/api/stream/status")
def get_stream_status():
    return {
        **stream_status,
        "model_ready": is_model_ready(),
        "model_error": get_model_error(),
    }


# ─── Webcam mode endpoints ────────────────────────────────────────────────────

@app.get("/api/webcam/status")
def get_webcam_status():
    return {
        **webcam_status,
        "model_ready": is_model_ready(),
        "model_error": get_model_error(),
    }


@app.post("/api/webcam/start")
async def start_webcam():
    global _processing_mode, _active_task
    if not is_model_ready():
        raise HTTPException(503, "YOLOv8n model not ready yet — please wait")

    _cancel_active()
    _processing_mode = "webcam"
    webcam_status["error"] = None
    webcam_status["active"] = False  # set True when loop starts
    # Drain old frames
    while not _cam_frame_queue.empty():
        try:
            _cam_frame_queue.get_nowait()
        except Exception:
            break
    _active_task = asyncio.create_task(webcam_processing_loop())
    return {"success": True}


@app.post("/api/webcam/stop")
async def stop_webcam():
    global _processing_mode
    _cancel_active()
    _processing_mode = "idle"
    webcam_status["active"] = False
    return {"success": True}


# ─── Built-in test MJPEG stream ───────────────────────────────────────────────

async def _test_frame_generator():
    """Generates synthetic MJPEG frames that cv2.VideoCapture can read.
    Renders a dark scene with moving coloured rectangles at ~12 fps
    so the stream pipeline can be tested without an external camera."""
    import cv2
    W, H = 1280, 720
    fps_interval = 1 / 12

    while True:
        t = time.time()
        frame = np.zeros((H, W, 3), dtype=np.uint8)

        # Grid background
        for x in range(0, W, 80):
            cv2.line(frame, (x, 0), (x, H), (20, 30, 50), 1)
        for y in range(0, H, 80):
            cv2.line(frame, (0, y), (W, y), (20, 30, 50), 1)

        # Three animated "people" (tall rectangles)
        for i, (base_x, spd, col) in enumerate([
            (200, 1.2, (80, 180, 80)),
            (600, 0.9, (180, 80, 80)),
            (1000, 1.5, (80, 80, 180)),
        ]):
            cx = int(base_x + 180 * math.sin(t * spd + i * 2))
            cy = int(H // 2 + 60 * math.cos(t * 0.7 + i))
            cv2.rectangle(frame, (cx - 30, cy - 70), (cx + 30, cy + 70), col, -1)
            cv2.putText(frame, f"test-{i+1}", (cx - 28, cy - 78),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.45, col, 1)

        # Timestamp overlay
        ts = time.strftime("%H:%M:%S", time.localtime(t))
        cv2.putText(frame, f"CrowdLens TEST STREAM  {ts}", (20, 36),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.7, (100, 180, 255), 2)

        _, buf = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, 80])
        yield (
            b"--frame\r\n"
            b"Content-Type: image/jpeg\r\n\r\n"
            + buf.tobytes()
            + b"\r\n"
        )
        await asyncio.sleep(fps_interval)


@app.get("/api/stream/test-feed")
async def test_feed():
    """MJPEG stream endpoint for local pipeline testing.
    Paste  http://localhost:8080/api/stream/test-feed  into the stream URL box."""
    return StreamingResponse(
        _test_frame_generator(),
        media_type="multipart/x-mixed-replace; boundary=frame",
    )


# ─── WebSocket: dashboard data broadcast ──────────────────────────────────────

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    connected_clients.append(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        if websocket in connected_clients:
            connected_clients.remove(websocket)


# ─── WebSocket: webcam frame receiver ────────────────────────────────────────

@app.websocket("/ws/cam")
async def webcam_ws(websocket: WebSocket):
    """Browser sends JPEG frames as binary; we queue them for YOLO processing."""
    await websocket.accept()
    print("[ws/cam] Webcam client connected")
    try:
        while True:
            data = await websocket.receive_bytes()
            if _processing_mode == "webcam":
                try:
                    _cam_frame_queue.put_nowait(data)
                except asyncio.QueueFull:
                    pass  # Drop frame if queue is full
    except WebSocketDisconnect:
        print("[ws/cam] Webcam client disconnected")
