"""
YOLOv4-tiny detector via OpenCV DNN.
Downloads cfg (~2KB) + weights (~23MB) on first use.
No PyTorch required — uses opencv-python-headless DNN module.
"""
import os
import cv2
import numpy as np
import urllib.request

MODEL_DIR = "models"
CFG_PATH = os.path.join(MODEL_DIR, "yolov4-tiny.cfg")
WEIGHTS_PATH = os.path.join(MODEL_DIR, "yolov4-tiny.weights")

CFG_URL = "https://raw.githubusercontent.com/AlexeyAB/darknet/master/cfg/yolov4-tiny.cfg"
WEIGHTS_URL = (
    "https://github.com/AlexeyAB/darknet/releases/download/"
    "darknet_yolo_v4_pre/yolov4-tiny.weights"
)

# COCO classes we track (matches original project)
TARGET_CLASSES = {0, 24, 26, 28, 39, 41, 67, 73}

COCO_NAMES = {
    0: "person", 24: "backpack", 26: "handbag", 28: "suitcase",
    39: "bottle", 41: "cup", 67: "cell phone", 73: "book",
}

# All 80 COCO names (needed for class index decoding)
_COCO_80 = [
    "person", "bicycle", "car", "motorbike", "aeroplane", "bus", "train",
    "truck", "boat", "traffic light", "fire hydrant", "stop sign",
    "parking meter", "bench", "bird", "cat", "dog", "horse", "sheep",
    "cow", "elephant", "bear", "zebra", "giraffe", "backpack", "umbrella",
    "handbag", "tie", "suitcase", "frisbee", "skis", "snowboard",
    "sports ball", "kite", "baseball bat", "baseball glove", "skateboard",
    "surfboard", "tennis racket", "bottle", "wine glass", "cup", "fork",
    "knife", "spoon", "bowl", "banana", "apple", "sandwich", "orange",
    "broccoli", "carrot", "hot dog", "pizza", "donut", "cake", "chair",
    "sofa", "potted plant", "bed", "dining table", "toilet", "tv monitor",
    "laptop", "mouse", "remote", "keyboard", "cell phone", "microwave",
    "oven", "toaster", "sink", "refrigerator", "book", "clock", "vase",
    "scissors", "teddy bear", "hair drier", "toothbrush",
]

_model_ready = False
_download_error: str | None = None


def _download_model():
    global _model_ready, _download_error
    os.makedirs(MODEL_DIR, exist_ok=True)
    try:
        if not os.path.exists(CFG_PATH):
            print("[detector] Downloading YOLOv4-tiny config (~2 KB)…")
            urllib.request.urlretrieve(CFG_URL, CFG_PATH)
            print("[detector] Config downloaded.")

        if not os.path.exists(WEIGHTS_PATH):
            print("[detector] Downloading YOLOv4-tiny weights (~23 MB)…")
            urllib.request.urlretrieve(WEIGHTS_URL, WEIGHTS_PATH)
            print("[detector] Weights downloaded.")

        _model_ready = True
        print("[detector] YOLOv4-tiny model ready.")
    except Exception as e:
        _download_error = str(e)
        print(f"[detector] Download failed: {e}")


def is_model_ready() -> bool:
    return _model_ready


def get_model_error() -> str | None:
    return _download_error


class YOLOv4TinyDetector:
    """Real object detector using YOLOv4-tiny via OpenCV DNN."""

    def __init__(self, conf_thresh: float = 0.30, nms_thresh: float = 0.45):
        if not (os.path.exists(CFG_PATH) and os.path.exists(WEIGHTS_PATH)):
            raise FileNotFoundError("YOLOv4-tiny model files not found")

        self.net = cv2.dnn.readNetFromDarknet(CFG_PATH, WEIGHTS_PATH)
        self.net.setPreferableBackend(cv2.dnn.DNN_BACKEND_OPENCV)
        self.net.setPreferableTarget(cv2.dnn.DNN_TARGET_CPU)

        layer_names = self.net.getLayerNames()
        self.output_layers = [
            layer_names[i - 1]
            for i in self.net.getUnconnectedOutLayers().flatten()
        ]
        self.conf_thresh = conf_thresh
        self.nms_thresh = nms_thresh

    def detect(self, frame: np.ndarray) -> list[dict]:
        """
        frame: BGR numpy array (any size).
        Returns: [{"bbox": [x1,y1,x2,y2], "class_id": int, "confidence": float}]
        """
        h, w = frame.shape[:2]
        blob = cv2.dnn.blobFromImage(
            frame, 1 / 255.0, (416, 416), swapRB=True, crop=False
        )
        self.net.setInput(blob)
        outputs = self.net.forward(self.output_layers)

        boxes, confidences, class_ids = [], [], []

        for output in outputs:
            for det in output:
                scores = det[5:]
                class_id = int(np.argmax(scores))
                if class_id not in TARGET_CLASSES:
                    continue
                conf = float(scores[class_id]) * float(det[4])
                if conf < self.conf_thresh:
                    continue

                cx = int(det[0] * w)
                cy = int(det[1] * h)
                bw = int(det[2] * w)
                bh = int(det[3] * h)
                boxes.append([cx - bw // 2, cy - bh // 2, bw, bh])
                confidences.append(conf)
                class_ids.append(class_id)

        if not boxes:
            return []

        indices = cv2.dnn.NMSBoxes(
            boxes, confidences, self.conf_thresh, self.nms_thresh
        )

        results = []
        for i in indices:
            i = int(i)
            x1, y1, bw, bh = boxes[i]
            results.append({
                "bbox": [float(x1), float(y1), float(x1 + bw), float(y1 + bh)],
                "class_id": class_ids[i],
                "confidence": round(confidences[i], 3),
            })
        return results


