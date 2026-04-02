FRAME_WIDTH = 1280
FRAME_HEIGHT = 720

# YOLOv8n detection settings (matches original project config.py)
YOLO_MODEL = "yolov8n.pt"
CONFIDENCE_THRESHOLD = 0.25

# Stream mode tuning:
# - keep stream decode light enough for real-time updates
# - use slightly lower confidence to improve small/distant person recall
STREAM_FRAME_WIDTH = 640
STREAM_FRAME_HEIGHT = 360
STREAM_TARGET_FPS = 12
STREAM_DETECTION_CONFIDENCE = 0.16

# Detection confidence overrides per mode.
# Lower values improve recall for small/far persons at the cost of more false positives.
VIDEO_DETECTION_CONFIDENCE = 0.20
WEBCAM_DETECTION_CONFIDENCE = 0.32

# Tracker confirmation policy.
# 1 = show a track from first matched frame (better responsiveness, fewer perceived misses).
TRACKER_MIN_HITS = 1

# Anomaly detection settings
OVERCROWDING_THRESHOLD = 4
RUNNING_SPEED_THRESHOLD = 20.0
RUNNING_PERSISTENCE_TIME = 0.8
RUNNING_MIN_HIT_STREAK = 4
UNATTENDED_OBJECT_TIME = 5.0
STATIONARY_THRESHOLD = 150.0
# Consider an object "attended" when a person is near it.
# This reduces false unattended alerts in crowded scenes.
UNATTENDED_OWNER_PROXIMITY_PX = 180.0
UNATTENDED_OWNER_GRACE_TIME = 2.0
FALL_ASPECT_RATIO_THRESHOLD = 1.45
FALL_PERSISTENCE_TIME = 1.0
RESTRICTED_ZONE_ENABLED = True
RESTRICTED_ZONE_MIN_DWELL = 0.6
# Fight/violence prototype heuristic (not a temporal deep model).
FIGHT_DETECTION_ENABLED = True
FIGHT_PROXIMITY_PX = 180.0
FIGHT_MIN_PAIR_SPEED = 16.0
FIGHT_PERSISTENCE_TIME = 0.8
FIGHT_MIN_HIT_STREAK = 3

# COCO class IDs for unattended object detection
# 24=backpack, 26=handbag, 28=suitcase, 39=bottle, 41=cup, 67=cell phone, 73=book
UNATTENDED_CLASSES = [24, 26, 28, 39, 41, 67, 73]

# Rectangular digital-fence areas in absolute frame coordinates.
# These defaults target the right-side corridor region in a 1280x720 frame.
RESTRICTED_ZONES = [
    {"id": "RZ1", "name": "Restricted Zone A", "x1": 920, "y1": 80, "x2": 1240, "y2": 520},
]

MAX_AGE = 50
MIN_HITS = 3
IOU_THRESHOLD = 0.3

# Classes we track (person + unattended objects)
COCO_CLASSES = {
    0: "person", 24: "backpack", 26: "handbag", 28: "suitcase",
    39: "bottle", 41: "cup", 67: "cell phone", 73: "book"
}
