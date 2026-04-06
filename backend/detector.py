"""
YOLO11n Detection Module
At startup, exports YOLO11n to ONNX format and reloads via ONNX Runtime —
2-3x faster CPU inference with identical accuracy. Falls back to the .pt
model automatically if the export fails.
"""

import os
import threading

import numpy as np
import torch

os.environ.setdefault("YOLO_CONFIG_DIR", "/tmp/Ultralytics")

from backend.config import COCO_CLASSES, CONFIDENCE_THRESHOLD, YOLO_MODEL

MODEL_PATH     = YOLO_MODEL                           # e.g. "yolo11n.pt"
ONNX_PATH      = MODEL_PATH.replace(".pt", ".onnx")   # e.g. "yolo11n.onnx"
TARGET_CLASSES = set(COCO_CLASSES.keys())

_model        = None
_model_ready  = False
_model_error: str | None = None
_model_device = "cpu"
_lock         = threading.Lock()


def is_model_ready() -> bool:
    return _model_ready


def get_model_error() -> str | None:
    return _model_error


def _download_model():
    """
    Load YOLO11n, export once to ONNX, then reload via ONNX Runtime.
    Falls back to the .pt model if ONNX export fails for any reason.
    Runs in a background thread at startup.
    """
    global _model, _model_ready, _model_error, _model_device
    try:
        from ultralytics import YOLO

        _model_device = "cuda:0" if torch.cuda.is_available() else "cpu"

        # ── Try ONNX (fast path) ──────────────────────────────────────────────
        if not os.path.exists(ONNX_PATH):
            print(f"[detector] Exporting {MODEL_PATH} → {ONNX_PATH} (one-time ~30 s)…")
            try:
                pt_model = YOLO(MODEL_PATH)
                pt_model.export(
                    format="onnx",
                    imgsz=640,
                    simplify=True,
                    opset=17,
                )
                print(f"[detector] Export complete → {ONNX_PATH}")
            except Exception as export_err:
                print(f"[detector] ONNX export failed ({export_err}); falling back to .pt")
                if os.path.exists(ONNX_PATH):
                    os.remove(ONNX_PATH)   # remove partial file

        if os.path.exists(ONNX_PATH):
            print(f"[detector] Loading {ONNX_PATH} via ONNX Runtime…")
            model = YOLO(ONNX_PATH)
            backend_label = "ONNX Runtime"
        else:
            print(f"[detector] Loading {MODEL_PATH} (PyTorch fallback)…")
            model = YOLO(MODEL_PATH)
            model.to(_model_device)
            backend_label = f"PyTorch on {_model_device}"

        # Warm-up
        dummy = np.zeros((640, 640, 3), dtype=np.uint8)
        model(dummy, conf=CONFIDENCE_THRESHOLD, verbose=False)

        _model = model
        _model_ready = True
        print(f"[detector] Model ready via {backend_label}.")
    except Exception as e:
        _model_error = str(e)
        print(f"[detector] Fatal model error: {e}")


class YOLOv8Detector:
    """YOLO11n detector — ONNX Runtime on CPU (falls back to PyTorch if needed)."""

    def __init__(self):
        if not _model_ready:
            raise RuntimeError("YOLO11n model not ready yet — wait for startup")

    def detect(self, frame: np.ndarray, conf_override: float | None = None) -> list[dict]:
        """
        Run YOLO11n inference on a BGR frame.

        Args:
            frame: numpy array (H × W × 3, BGR)

        Returns:
            list of {"bbox": [x1,y1,x2,y2], "class_id": int, "confidence": float}
        """
        conf = CONFIDENCE_THRESHOLD if conf_override is None else conf_override
        with _lock:
            results = _model(frame, conf=conf, verbose=False)[0]

        detections = []
        for box in results.boxes:
            x1, y1, x2, y2 = box.xyxy[0].cpu().numpy()
            confidence = float(box.conf[0].cpu().numpy())
            class_id   = int(box.cls[0].cpu().numpy())

            if class_id not in TARGET_CLASSES:
                continue

            detections.append({
                "bbox":       [float(x1), float(y1), float(x2), float(y2)],
                "confidence": round(confidence, 3),
                "class_id":   class_id,
            })
        return detections
