import asyncio
import json
import os
import time
import threading
from collections import deque
from contextlib import asynccontextmanager

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from backend.anomaly import AnomalyDetector
from backend.simulation import SimulationEngine
from backend.config import (
    OVERCROWDING_THRESHOLD, RUNNING_SPEED_THRESHOLD,
    UNATTENDED_OBJECT_TIME, STATIONARY_THRESHOLD, COCO_CLASSES,
)
from backend.detector import _download_model, is_model_ready, get_model_error

# ─── State ──────────────────────────────────────────────────────────────────

simulation = SimulationEngine()
sim_anomaly_detector = AnomalyDetector()
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

# ─── Video mode state ────────────────────────────────────────────────────────

VIDEO_UPLOAD_PATH = "/tmp/crowdlens_upload.mp4"
_processing_mode = "simulation"   # "simulation" | "video"
_video_task: asyncio.Task | None = None
_video_anomaly_detector = AnomalyDetector()

video_status = {
    "mode": "simulation",
    "filename": None,
    "progress": 0.0,
    "total_frames": 0,
    "current_frame": 0,
    "model_ready": False,
    "model_error": None,
    "error": None,
}


# ─── Helpers ─────────────────────────────────────────────────────────────────

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


def build_frame_payload(tracks: list, anomalies: list, now: float) -> dict:
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
    for a in serializable_anomalies:
        if _should_record_alert(a, now):
            _alert_id_counter += 1
            alert_history.append({
                "id": _alert_id_counter,
                "anomaly": a,
                "timestamp": now,
                "iso": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(now)),
                "source": _processing_mode,
            })

    return {
        "tracks": tracks,
        "anomalies": serializable_anomalies,
        "stats": stats_snapshot.copy(),
        "timestamp": now,
        "mode": _processing_mode,
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
        connected_clients.remove(d)


# ─── Simulation loop ─────────────────────────────────────────────────────────

async def simulation_loop():
    interval = 0.1
    while True:
        start = asyncio.get_event_loop().time()
        if connected_clients and _processing_mode == "simulation":
            _apply_config()
            tracks = simulation.tick()
            now = time.time()
            anomalies = sim_anomaly_detector.update(tracks, now)

            # Add zone to tracks
            for t in tracks:
                cx = (t["x1"] + t["x2"]) / 2
                t["zone"] = _get_zone(cx)

            payload = build_frame_payload(tracks, anomalies, now)
            await _broadcast(json.dumps(payload))

        elapsed = asyncio.get_event_loop().time() - start
        await asyncio.sleep(max(0, interval - elapsed))


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
                # Loop video
                cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
                frame_num = 0
                tracker.reset()
                _video_anomaly_detector = AnomalyDetector()
                continue

            frame_num += 1
            video_status["current_frame"] = frame_num
            video_status["progress"] = round((frame_num / total * 100), 1) if total > 0 else 0

            # Resize to match canvas dimensions
            frame = cv2.resize(frame, (1280, 720))

            # Run YOLOv8n detection (ultralytics)
            detections = detector.detect(frame)

            # Run SORT tracking
            raw_tracks = tracker.update(detections)

            # Build track list in our standard format
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
                    "confidence": round(t["confidence"], 2),
                    "zone": _get_zone(cx),
                })

            now = time.time()
            _apply_config()
            anomalies = _video_anomaly_detector.update(tracks, now)

            # Mark running tracks
            running_ids = {
                a.get("track_id") for a in anomalies if a["type"] == "running"
            }
            for t in tracks:
                t["running"] = t["id"] in running_ids

            payload = build_frame_payload(tracks, anomalies, now)
            if connected_clients:
                await _broadcast(json.dumps(payload))

            await asyncio.sleep(0.04)  # ~25fps cap; actual FPS limited by YOLO speed

    except asyncio.CancelledError:
        pass
    finally:
        cap.release()
        video_status["progress"] = 0


# ─── Lifespan ────────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Start model download in background thread (non-blocking)
    thread = threading.Thread(target=_download_model, daemon=True)
    thread.start()

    sim_task = asyncio.create_task(simulation_loop())
    yield

    sim_task.cancel()
    if _video_task and not _video_task.done():
        _video_task.cancel()

    try:
        await sim_task
    except asyncio.CancelledError:
        pass


# ─── App ─────────────────────────────────────────────────────────────────────

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
    if len(content) > 200 * 1024 * 1024:
        raise HTTPException(400, "File too large (max 200 MB)")

    with open(VIDEO_UPLOAD_PATH, "wb") as f:
        f.write(content)

    video_status["filename"] = file.filename
    video_status["mode"] = "ready"
    video_status["progress"] = 0
    return {"success": True, "filename": file.filename, "size_mb": round(len(content) / 1e6, 1)}


@app.post("/api/video/start")
async def start_video():
    global _processing_mode, _video_task
    if not os.path.exists(VIDEO_UPLOAD_PATH):
        raise HTTPException(400, "No video uploaded yet")
    if not is_model_ready():
        raise HTTPException(503, "YOLOv8n model is still loading, please wait")

    if _video_task and not _video_task.done():
        _video_task.cancel()

    _processing_mode = "video"
    video_status["mode"] = "processing"
    _video_task = asyncio.create_task(video_processing_loop())
    return {"success": True}


@app.post("/api/video/stop")
async def stop_video():
    global _processing_mode, _video_task
    if _video_task and not _video_task.done():
        _video_task.cancel()
        _video_task = None
    _processing_mode = "simulation"
    video_status["mode"] = "simulation"
    video_status["progress"] = 0
    return {"success": True}


@app.get("/api/video/status")
def get_video_status():
    return {
        **video_status,
        "model_ready": is_model_ready(),
        "model_error": get_model_error(),
    }


# ─── WebSocket ────────────────────────────────────────────────────────────────

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
