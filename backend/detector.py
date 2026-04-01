"""
YOLOv8 Detection Module
Uses ultralytics YOLOv8n - matches the original project detection.py exactly.
Model: yolov8n.pt (6.3 MB, auto-downloaded on first run)
"""
import os
import threading
import numpy as np

# Point ultralytics settings to /tmp so it doesn't try to write to read-only dirs
os.environ.setdefault("YOLO_CONFIG_DIR", "/tmp/Ultralytics")

from backend.config import CONFIDENCE_THRESHOLD, COCO_CLASSES

MODEL_PATH = "yolov8n.pt"          # relative to workspace root (uvicorn cwd)
TARGET_CLASSES = set(COCO_CLASSES.keys())

_model = None
_model_ready = False
_model_error: str | None = None
_lock = threading.Lock()


def is_model_ready() -> bool:
    return _model_ready


def get_model_error() -> str | None:
    return _model_error


def _download_model():
    """Load (and auto-download) the YOLOv8n model. Runs in a background thread."""
    global _model, _model_ready, _model_error
    try:
        from ultralytics import YOLO
        print("[detector] Loading YOLOv8n model (ultralytics)…")
        model = YOLO(MODEL_PATH)          # downloads automatically if not present
        # Warm-up inference to compile kernels
        dummy = np.zeros((640, 640, 3), dtype=np.uint8)
        model(dummy, conf=CONFIDENCE_THRESHOLD, verbose=False)
        _model = model
        _model_ready = True
        print("[detector] YOLOv8n model ready.")
    except Exception as e:
        _model_error = str(e)
        print(f"[detector] Model error: {e}")


class YOLOv8Detector:
    """
    YOLOv8n-based object detector via ultralytics.
    Matches the original project's ObjectDetector class.
    """

    def __init__(self):
        if not _model_ready:
            raise RuntimeError("YOLOv8n model not ready yet — wait for download")

    def detect(self, frame: np.ndarray) -> list[dict]:
        """
        Run YOLOv8n inference on a BGR frame.

        Args:
            frame: numpy array (H x W x 3, BGR)

        Returns:
            List of dicts: [{"bbox": [x1,y1,x2,y2], "class_id": int, "confidence": float}]
        """
        with _lock:
            results = _model(frame, conf=CONFIDENCE_THRESHOLD, verbose=False)[0]

        detections = []
        for box in results.boxes:
            x1, y1, x2, y2 = box.xyxy[0].cpu().numpy()
            confidence = float(box.conf[0].cpu().numpy())
            class_id = int(box.cls[0].cpu().numpy())

            # Only track classes from our config (person, bags, bottles, etc.)
            if class_id not in TARGET_CLASSES:
                continue

            detections.append({
                "bbox": [float(x1), float(y1), float(x2), float(y2)],
                "confidence": round(confidence, 3),
                "class_id": class_id,
            })
        return detections
