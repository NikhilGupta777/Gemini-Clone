FRAME_WIDTH = 1280
FRAME_HEIGHT = 720

# YOLOv8n detection settings (matches original project config.py)
YOLO_MODEL = "yolov8n.pt"
CONFIDENCE_THRESHOLD = 0.25

# Anomaly detection settings
OVERCROWDING_THRESHOLD = 2
RUNNING_SPEED_THRESHOLD = 20.0
UNATTENDED_OBJECT_TIME = 5.0
STATIONARY_THRESHOLD = 150.0

# COCO class IDs for unattended object detection
# 24=backpack, 26=handbag, 28=suitcase, 39=bottle, 41=cup, 67=cell phone, 73=book
UNATTENDED_CLASSES = [24, 26, 28, 39, 41, 67, 73]

MAX_AGE = 50
MIN_HITS = 3
IOU_THRESHOLD = 0.3

# Classes we track (person + unattended objects)
COCO_CLASSES = {
    0: "person", 24: "backpack", 26: "handbag", 28: "suitcase",
    39: "bottle", 41: "cup", 67: "cell phone", 73: "book"
}
