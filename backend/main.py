import asyncio
import json
import time
from collections import deque
from typing import Any

import numpy as np
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from backend.anomaly import AnomalyDetector
from backend.simulation import SimulationEngine
from backend.config import (
    OVERCROWDING_THRESHOLD, RUNNING_SPEED_THRESHOLD,
    UNATTENDED_OBJECT_TIME, STATIONARY_THRESHOLD
)

app = FastAPI(title="CrowdLens API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

simulation = SimulationEngine()
detector = AnomalyDetector()
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
    "fps": 10,
    "uptime_seconds": 0,
}

_start_time = time.time()


def build_frame_payload(tracks: list, anomalies: list) -> dict:
    person_count = sum(1 for t in tracks if t["class_id"] == 0)
    object_count = sum(1 for t in tracks if t["class_id"] != 0)

    stats_snapshot.update({
        "person_count": person_count,
        "object_count": object_count,
        "anomaly_count": len(anomalies),
        "uptime_seconds": round(time.time() - _start_time),
    })

    serializable_anomalies = []
    for a in anomalies:
        sa = dict(a)
        if sa.get("position") is not None:
            pos = sa["position"]
            sa["position"] = [float(pos[0]), float(pos[1])]
        serializable_anomalies.append(sa)

    for a in serializable_anomalies:
        if a not in [h["anomaly"] for h in list(alert_history)[-5:]]:
            ts = time.time()
            alert_history.append({
                "id": int(ts * 1000),
                "anomaly": a,
                "timestamp": ts,
                "iso": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(ts))
            })

    return {
        "tracks": tracks,
        "anomalies": serializable_anomalies,
        "stats": stats_snapshot.copy(),
        "timestamp": time.time(),
    }


async def simulation_loop():
    interval = 0.1
    while True:
        start = asyncio.get_event_loop().time()

        if connected_clients:
            tracks = simulation.tick()

            from backend import config as cfg
            cfg.OVERCROWDING_THRESHOLD = current_config["overcrowding_threshold"]
            cfg.RUNNING_SPEED_THRESHOLD = current_config["running_speed_threshold"]
            cfg.UNATTENDED_OBJECT_TIME = current_config["unattended_object_time"]
            cfg.STATIONARY_THRESHOLD = current_config["stationary_threshold"]

            import backend.anomaly as am
            am.OVERCROWDING_THRESHOLD = current_config["overcrowding_threshold"]
            am.RUNNING_SPEED_THRESHOLD = current_config["running_speed_threshold"]
            am.UNATTENDED_OBJECT_TIME = current_config["unattended_object_time"]
            am.STATIONARY_THRESHOLD = current_config["stationary_threshold"]

            anomalies = detector.update(tracks, time.time())
            payload = build_frame_payload(tracks, anomalies)
            message = json.dumps(payload)

            dead = []
            for ws in connected_clients:
                try:
                    await ws.send_text(message)
                except Exception:
                    dead.append(ws)
            for d in dead:
                connected_clients.remove(d)

        elapsed = asyncio.get_event_loop().time() - start
        await asyncio.sleep(max(0, interval - elapsed))


@app.on_event("startup")
async def startup():
    asyncio.create_task(simulation_loop())


@app.get("/api/health")
def health():
    return {"status": "ok", "uptime": round(time.time() - _start_time)}


@app.get("/api/stats")
def get_stats():
    return stats_snapshot


@app.get("/api/alerts/history")
def get_alert_history(limit: int = 100):
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
