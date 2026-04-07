# CrowdLens · Campus AI Monitor

## Overview

Full-stack real-time surveillance and anomaly detection system. A Python FastAPI backend can run real YOLOv8n + SORT tracking on live webcam frames, uploaded video files, and RTSP/HTTP streams. Falls back to simulation mode when no real source is active. React + Vite frontend renders a live surveillance dashboard with WebSocket-powered bounding boxes, stats, and incident logs.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Python version**: 3.11
- **Package manager**: pnpm + uv (Python)
- **Frontend**: React 19 + Vite 7 + TailwindCSS v4 + shadcn/ui
- **Backend**: Python FastAPI + uvicorn + WebSockets + numpy
- **Computer vision**: YOLOv8n (ultralytics) + OpenCV headless
- **Real-time**: WebSocket at 10 fps; webcam frames sent browser → `/ws/cam`
- **Routing**: wouter (frontend SPA)

## Detection Modes

1. **Simulation** — synthetic entities with anomaly injection (fallback/default)
2. **Video Upload** — real YOLOv8n inference on uploaded MP4/AVI/MOV (up to 500 MB)
3. **Webcam (browser)** — JPEG frames captured at 10 fps by `useCamProcessor` hook, sent over `/ws/cam`, processed server-side with YOLO + SORT
4. **RTSP/HTTP Stream** — backend opens any RTSP or HTTP camera URL with OpenCV, runs YOLO + SORT in a background thread

## Features

- **Live Surveillance Canvas** — Canvas2D rendering of tracked entities with bounding boxes, zone overlays (ZONE A/B/C), scan-line animation, REC indicator
- **Mode HUD badges** — YOLO·WEBCAM / YOLO·VIDEO / YOLO·STREAM / SIMULATION shown on the canvas
- **Anomaly Detection** — Running, Unattended Object, Overcrowding
- **Stats Cards** — Live occupancy, threat level, total tracks, system uptime
- **Alert History** — Full incident log table with timestamp, type, details, position
- **Settings** — Real-time threshold tuning via sliders with live PUT to backend

## Structure

```
├── artifacts/company-ai/          # React+Vite surveillance dashboard
│   ├── src/
│   │   ├── App.tsx
│   │   ├── hooks/
│   │   │   ├── useSimulation.ts   # WebSocket hook (simulation frames)
│   │   │   └── useCamProcessor.ts # Captures webcam → sends JPEG to /ws/cam
│   │   ├── pages/
│   │   │   ├── Dashboard.tsx      # Video upload + stream panels + webcam button
│   │   │   ├── AlertHistory.tsx
│   │   │   └── Settings.tsx
│   │   └── components/
│   │       ├── Layout.tsx
│   │       ├── SimulationCanvas.tsx # Renders all 4 modes
│   │       ├── StatsCards.tsx
│   │       └── AlertsFeed.tsx
│   └── vite.config.ts             # Proxy /api + /ws → port 8080
├── backend/
│   ├── main.py                    # FastAPI, all endpoints, all processing loops
│   ├── detector.py                # YOLOv8n + SORT tracker wrapper
│   ├── simulation.py              # Entity simulation engine
│   ├── anomaly.py                 # Anomaly detection logic
│   └── config.py                  # Detection thresholds and COCO classes
```

## Running

- **Frontend**: `Frontend` workflow — Vite dev server on port 3000
- **Backend**: `Start application` workflow — uvicorn on port 8080
- Frontend proxies `/api` and `/ws` to the Python backend

## Running Locally (on your own laptop)

This is required for connecting **campus/home IP cameras** since the cloud backend cannot reach private networks.

```bash
# Terminal 1 — Backend
ALLOW_LOCAL_STREAMS=true uv run uvicorn backend.main:app --host 0.0.0.0 --port 8080 --reload

# Terminal 2 — Frontend
pnpm --filter @workspace/company-ai run dev
```

Then open `http://localhost:3000` in your browser.

`ALLOW_LOCAL_STREAMS=true` removes the private-IP restriction so you can connect:
- Campus RTSP cameras: `rtsp://admin:pass@192.168.x.x:554/stream` → paste in **Live Stream** panel
- Campus MJPEG cameras: `http://192.168.x.x/video.cgi` → paste in **Live Webcam → Local Network Camera**
- Snapshot URL (no CORS needed): `http://192.168.x.x/snapshot.jpg` → same section above

## API Endpoints

- `GET /api/health` — health check
- `GET /api/stats` — current stats
- `GET /api/alerts/history?limit=N` — incident log
- `GET /api/config` / `PUT /api/config` — detection thresholds
- `GET /api/video/status` — video processing status + model_ready
- `POST /api/video/upload` — upload video file for YOLO processing
- `POST /api/video/stop`
- `POST /api/webcam/start` / `POST /api/webcam/stop`
- `GET /api/stream/status` — stream status + model_ready
- `POST /api/stream/start` (body: `{"url": "rtsp://..."}`)
- `POST /api/stream/stop`
- `WS /ws` — simulation/video/stream detection frames at 10 fps
- `WS /ws/cam` — receives JPEG binary frames from browser webcam

## Nix System Dependencies

Includes `xorg.libxcb`, `xorg.libX11`, `xorg.libXext` — required by OpenCV headless for internal threading even without a display.
