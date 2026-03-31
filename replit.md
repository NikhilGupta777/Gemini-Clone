# CrowdLens · Campus AI Monitor

## Overview

Full-stack surveillance and anomaly detection simulation system for a college project. A Python FastAPI backend simulates crowd movements and detects anomalies in real-time. A React + Vite frontend renders a live surveillance dashboard with WebSocket-powered bounding boxes, stats, and incident logs.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Python version**: 3.11
- **Package manager**: pnpm + uv (Python)
- **Frontend**: React 19 + Vite 7 + TailwindCSS v4 + shadcn/ui
- **Backend**: Python FastAPI + uvicorn + WebSockets + numpy
- **Real-time**: WebSocket (simulation frames at 10 fps)
- **Routing**: wouter (frontend SPA)

## Features

- **Live Surveillance Canvas** — Canvas2D rendering of tracked entities with bounding boxes, zone overlays (ZONE A/B/C), scan-line animation, REC indicator
- **Anomaly Detection** — Three detection types:
  - **Running** (purple) — person speed exceeds threshold
  - **Unattended Object** (red) — object stationary for > N seconds
  - **Overcrowding** (orange) — person count exceeds threshold
- **Stats Cards** — Live occupancy, threat level (with pulse animation), total tracks, system uptime
- **Alert History** — Full incident log table with timestamp, type, details, position; auto-refreshes every 2s
- **Settings** — Real-time threshold tuning (overcrowding limit, running speed, unattended time, stationary distance) via sliders with live PUT to backend
- **Threat Level Header** — SYSTEM SECURE / ALERT ACTIVE / THREAT DETECTED with blinking indicator

## Structure

```
├── artifacts/company-ai/          # React+Vite surveillance dashboard
│   ├── src/
│   │   ├── App.tsx                # Root app, threat level logic
│   │   ├── hooks/useSimulation.ts # WebSocket hook w/ auto-reconnect
│   │   ├── pages/
│   │   │   ├── Dashboard.tsx      # Main canvas + stats + alerts
│   │   │   ├── AlertHistory.tsx   # Incident log table
│   │   │   └── Settings.tsx       # Threshold configuration
│   │   └── components/
│   │       ├── Layout.tsx         # Sidebar nav + header
│   │       ├── SimulationCanvas.tsx # Canvas2D rendering engine
│   │       ├── StatsCards.tsx     # Live stat panels
│   │       └── AlertsFeed.tsx     # Active incidents panel
│   └── vite.config.ts             # Proxy /api + /ws → port 8080
├── backend/
│   ├── main.py                    # FastAPI app, WebSocket endpoint, REST API
│   ├── simulation.py              # Entity simulation engine
│   ├── anomaly.py                 # Anomaly detection logic
│   └── config.py                  # Detection thresholds and COCO classes
├── lib/
│   ├── api-client-react/          # (unused by CrowdLens, from prior scaffold)
│   └── ...
```

## Running

- **Frontend**: `artifacts/company-ai: web` workflow — Vite dev server on port 18611
- **Backend**: `Start application` workflow — uvicorn on port 8080
- Frontend proxies `/api` and `/ws` to the Python backend

## API Endpoints (Python FastAPI)

- `GET /api/health` — health check
- `GET /api/stats` — current simulation stats
- `GET /api/alerts/history?limit=N` — incident log
- `GET /api/config` — current detection thresholds
- `PUT /api/config` — update thresholds (live, no restart needed)
- `WS /ws` — real-time simulation frames at 10 fps

## Detection Config Defaults

- Overcrowding threshold: 2 people
- Running speed threshold: 20 px/frame
- Unattended object time: 5 seconds
- Stationary distance: 150 px
