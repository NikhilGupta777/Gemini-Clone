import numpy as np
from backend.config import (
    OVERCROWDING_THRESHOLD, RUNNING_SPEED_THRESHOLD,
    RUNNING_PERSISTENCE_TIME, RUNNING_MIN_HIT_STREAK,
    UNATTENDED_OBJECT_TIME, STATIONARY_THRESHOLD, UNATTENDED_CLASSES,
    UNATTENDED_OWNER_PROXIMITY_PX, UNATTENDED_OWNER_GRACE_TIME,
    FALL_ASPECT_RATIO_THRESHOLD, FALL_PERSISTENCE_TIME,
    RESTRICTED_ZONE_ENABLED, RESTRICTED_ZONE_MIN_DWELL, RESTRICTED_ZONES,
    FIGHT_DETECTION_ENABLED, FIGHT_PROXIMITY_PX, FIGHT_MIN_PAIR_SPEED,
    FIGHT_PERSISTENCE_TIME, FIGHT_MIN_HIT_STREAK,
    FRAME_WIDTH, FRAME_HEIGHT,
)


class AnomalyDetector:
    def __init__(self):
        self.track_history: dict = {}
        self.running_candidate_since: dict[int, float] = {}
        self.fall_candidate_since: dict[int, float] = {}
        self.zone_entry_since: dict[tuple[int, str], float] = {}
        self.fight_candidate_since: dict[tuple[int, int], float] = {}
        self.fight_last_alert_at: dict[tuple[int, int], float] = {}
        self.owner_absent_since: dict[int, float] = {}

    def update(self, tracks: list, current_time: float) -> list:
        anomalies = []

        person_count = sum(1 for t in tracks if t["class_id"] == 0)
        if person_count > OVERCROWDING_THRESHOLD:
            anomalies.append({"type": "overcrowding", "count": person_count, "position": None})

        person_positions = [
            (
                (t["x1"] + t["x2"]) / 2.0,
                (t["y1"] + t["y2"]) / 2.0,
            )
            for t in tracks
            if t["class_id"] == 0
        ]

        person_motion: dict[int, dict] = {}

        for track in tracks:
            track_id = track["id"]
            class_id = track["class_id"]
            cx = (track["x1"] + track["x2"]) / 2.0
            cy = (track["y1"] + track["y2"]) / 2.0

            if track_id not in self.track_history:
                self.track_history[track_id] = []

            w = max(1.0, float(track["x2"] - track["x1"]))
            h = max(1.0, float(track["y2"] - track["y1"]))
            self.track_history[track_id].append((cx, cy, current_time, w, h))
            self.track_history[track_id] = self.track_history[track_id][-20:]
            history = self.track_history[track_id]

            if class_id == 0 and len(history) >= 5:
                hit_streak = int(track.get("hit_streak", 0))
                recent = history[-5:]
                dist = 0
                for i in range(1, len(recent)):
                    dist += np.hypot(recent[i][0] - recent[i-1][0], recent[i][1] - recent[i-1][1])
                avg_speed = dist / len(recent)
                person_motion[track_id] = {
                    "cx": cx,
                    "cy": cy,
                    "avg_speed": float(avg_speed),
                    "hit_streak": hit_streak,
                }

                # Require stable track age and persistence window to reduce
                # false running alerts from brief SORT ID switches/jitter.
                if hit_streak >= RUNNING_MIN_HIT_STREAK and avg_speed > RUNNING_SPEED_THRESHOLD:
                    if track_id not in self.running_candidate_since:
                        self.running_candidate_since[track_id] = current_time
                    elif current_time - self.running_candidate_since[track_id] >= RUNNING_PERSISTENCE_TIME:
                        anomalies.append({
                            "type": "running",
                            "track_id": track_id,
                            "avg_speed": round(avg_speed, 1),
                            "position": [cx, cy]
                        })
                else:
                    self.running_candidate_since.pop(track_id, None)

                # Fall detection heuristic: person appears horizontally oriented
                # (w/h exceeds threshold) for a minimum persistence window.
                aspect_ratio = w / h
                if aspect_ratio >= FALL_ASPECT_RATIO_THRESHOLD:
                    if track_id not in self.fall_candidate_since:
                        self.fall_candidate_since[track_id] = current_time
                    elif current_time - self.fall_candidate_since[track_id] >= FALL_PERSISTENCE_TIME:
                        anomalies.append({
                            "type": "fall_detected",
                            "track_id": track_id,
                            "duration": round(current_time - self.fall_candidate_since[track_id], 1),
                            "aspect_ratio": round(aspect_ratio, 2),
                            "position": [cx, cy],
                        })
                else:
                    self.fall_candidate_since.pop(track_id, None)

                # Digital fencing: unauthorized person in restricted zone.
                if RESTRICTED_ZONE_ENABLED:
                    frame_w = max(1, int(track.get("frame_width", FRAME_WIDTH)))
                    frame_h = max(1, int(track.get("frame_height", FRAME_HEIGHT)))
                    sx = frame_w / FRAME_WIDTH
                    sy = frame_h / FRAME_HEIGHT
                    for zone in RESTRICTED_ZONES:
                        zone_id = zone["id"]
                        zx1 = zone["x1"] * sx
                        zx2 = zone["x2"] * sx
                        zy1 = zone["y1"] * sy
                        zy2 = zone["y2"] * sy
                        inside = (
                            zx1 <= cx <= zx2
                            and zy1 <= cy <= zy2
                        )
                        key = (track_id, zone_id)
                        if inside:
                            if key not in self.zone_entry_since:
                                self.zone_entry_since[key] = current_time
                            dwell = current_time - self.zone_entry_since[key]
                            if dwell >= RESTRICTED_ZONE_MIN_DWELL:
                                anomalies.append({
                                    "type": "restricted_zone",
                                    "track_id": track_id,
                                    "zone_id": zone_id,
                                    "zone_name": zone.get("name", zone_id),
                                    "duration": round(dwell, 1),
                                    "position": [cx, cy],
                                })
                        else:
                            self.zone_entry_since.pop(key, None)

            elif class_id in UNATTENDED_CLASSES:
                first_seen = history[0][2]
                duration = current_time - first_seen
                nearest_person = min(
                    (np.hypot(cx - px, cy - py) for px, py in person_positions),
                    default=float("inf"),
                )
                is_attended = nearest_person <= UNATTENDED_OWNER_PROXIMITY_PX

                if is_attended:
                    self.owner_absent_since.pop(track_id, None)
                    continue

                if track_id not in self.owner_absent_since:
                    self.owner_absent_since[track_id] = current_time
                owner_absent_time = current_time - self.owner_absent_since[track_id]

                if duration >= UNATTENDED_OBJECT_TIME and owner_absent_time >= UNATTENDED_OWNER_GRACE_TIME:
                    start_pos = history[0]
                    dist_moved = np.hypot(cx - start_pos[0], cy - start_pos[1])
                    if dist_moved < STATIONARY_THRESHOLD:
                        anomalies.append({
                            "type": "unattended_object",
                            "track_id": track_id,
                            "duration": round(duration, 1),
                            "owner_absent": round(owner_absent_time, 1),
                            "position": [cx, cy]
                        })

        if FIGHT_DETECTION_ENABLED and len(person_motion) >= 2:
            active_fight_pairs: set[tuple[int, int]] = set()
            person_ids = sorted(person_motion.keys())
            for i in range(len(person_ids)):
                for j in range(i + 1, len(person_ids)):
                    id1 = person_ids[i]
                    id2 = person_ids[j]
                    p1 = person_motion[id1]
                    p2 = person_motion[id2]
                    pair_key = (id1, id2)

                    close_enough = np.hypot(p1["cx"] - p2["cx"], p1["cy"] - p2["cy"]) <= FIGHT_PROXIMITY_PX
                    fast_both = (
                        p1["avg_speed"] >= FIGHT_MIN_PAIR_SPEED
                        and p2["avg_speed"] >= FIGHT_MIN_PAIR_SPEED
                    )
                    stable_tracks = (
                        p1["hit_streak"] >= FIGHT_MIN_HIT_STREAK
                        and p2["hit_streak"] >= FIGHT_MIN_HIT_STREAK
                    )

                    if close_enough and fast_both and stable_tracks:
                        active_fight_pairs.add(pair_key)
                        if pair_key not in self.fight_candidate_since:
                            self.fight_candidate_since[pair_key] = current_time
                            continue

                        persisted = current_time - self.fight_candidate_since[pair_key]
                        if persisted >= FIGHT_PERSISTENCE_TIME:
                            last_alert = self.fight_last_alert_at.get(pair_key, 0.0)
                            # Keep signal visible while avoiding frame-by-frame alert spam.
                            if current_time - last_alert >= 1.5:
                                mid_x = (p1["cx"] + p2["cx"]) / 2.0
                                mid_y = (p1["cy"] + p2["cy"]) / 2.0
                                anomalies.append({
                                    "type": "fight_suspected",
                                    "track_id": id1,
                                    "track_ids": [id1, id2],
                                    "avg_pair_speed": round((p1["avg_speed"] + p2["avg_speed"]) / 2.0, 1),
                                    "distance": float(round(np.hypot(p1["cx"] - p2["cx"], p1["cy"] - p2["cy"]), 1)),
                                    "duration": round(persisted, 1),
                                    "position": [mid_x, mid_y],
                                })
                                self.fight_last_alert_at[pair_key] = current_time
                    else:
                        self.fight_candidate_since.pop(pair_key, None)
                        self.fight_last_alert_at.pop(pair_key, None)

            stale_fights = [k for k in self.fight_candidate_since if k not in active_fight_pairs]
            for k in stale_fights:
                self.fight_candidate_since.pop(k, None)
                self.fight_last_alert_at.pop(k, None)

        active_ids = {t["id"] for t in tracks}
        stale = [k for k in self.track_history if k not in active_ids]
        for k in stale:
            del self.track_history[k]
            self.running_candidate_since.pop(k, None)
            self.fall_candidate_since.pop(k, None)
            self.owner_absent_since.pop(k, None)

        stale_zone_keys = [k for k in self.zone_entry_since if k[0] not in active_ids]
        for k in stale_zone_keys:
            del self.zone_entry_since[k]

        stale_fight_keys = [k for k in self.fight_candidate_since if k[0] not in active_ids or k[1] not in active_ids]
        for k in stale_fight_keys:
            self.fight_candidate_since.pop(k, None)
            self.fight_last_alert_at.pop(k, None)

        return anomalies
