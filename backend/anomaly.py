import numpy as np
import time
from backend.config import (
    OVERCROWDING_THRESHOLD, RUNNING_SPEED_THRESHOLD,
    UNATTENDED_OBJECT_TIME, STATIONARY_THRESHOLD, UNATTENDED_CLASSES
)


class AnomalyDetector:
    def __init__(self):
        self.track_history: dict = {}

    def update(self, tracks: list, current_time: float) -> list:
        anomalies = []

        person_count = sum(1 for t in tracks if t["class_id"] == 0)
        if person_count > OVERCROWDING_THRESHOLD:
            anomalies.append({"type": "overcrowding", "count": person_count, "position": None})

        for track in tracks:
            track_id = track["id"]
            class_id = track["class_id"]
            cx = (track["x1"] + track["x2"]) / 2.0
            cy = (track["y1"] + track["y2"]) / 2.0

            if track_id not in self.track_history:
                self.track_history[track_id] = []

            self.track_history[track_id].append((cx, cy, current_time))
            self.track_history[track_id] = self.track_history[track_id][-20:]
            history = self.track_history[track_id]

            if class_id == 0 and len(history) >= 5:
                recent = history[-5:]
                dist = 0
                for i in range(1, len(recent)):
                    dist += np.hypot(recent[i][0] - recent[i-1][0], recent[i][1] - recent[i-1][1])
                avg_speed = dist / len(recent)
                if avg_speed > RUNNING_SPEED_THRESHOLD:
                    anomalies.append({
                        "type": "running",
                        "track_id": track_id,
                        "avg_speed": round(avg_speed, 1),
                        "position": [cx, cy]
                    })

            elif class_id in UNATTENDED_CLASSES:
                first_seen = history[0][2]
                duration = current_time - first_seen
                if duration >= UNATTENDED_OBJECT_TIME:
                    start_pos = history[0]
                    dist_moved = np.hypot(cx - start_pos[0], cy - start_pos[1])
                    if dist_moved < STATIONARY_THRESHOLD:
                        anomalies.append({
                            "type": "unattended_object",
                            "track_id": track_id,
                            "duration": round(duration, 1),
                            "position": [cx, cy]
                        })

        active_ids = {t["id"] for t in tracks}
        stale = [k for k in self.track_history if k not in active_ids]
        for k in stale:
            del self.track_history[k]

        return anomalies
