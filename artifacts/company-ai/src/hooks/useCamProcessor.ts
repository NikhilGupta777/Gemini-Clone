/**
 * useCamProcessor
 * ───────────────
 * Captures frames from a <video> element (live webcam) every ~100ms,
 * encodes them as JPEG and sends binary over /ws/cam to the backend.
 * The backend runs YOLO+SORT and broadcasts results via /ws to all clients.
 */
import { useEffect, useRef, useCallback } from "react";

const FRAME_W = 640;
const FRAME_H = 360;
const JPEG_QUALITY = 0.7;
const INTERVAL_MS = 100; // ~10fps to backend (UI updates at full 30fps from simulation)

function getWsCamUrl() {
  const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${proto}//${window.location.host}/ws/cam`;
}

export function useCamProcessor(
  videoEl: HTMLVideoElement | null,
  active: boolean,
) {
  const wsRef = useRef<WebSocket | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const timerRef = useRef<number | null>(null);
  const activeRef = useRef(active);

  useEffect(() => {
    activeRef.current = active;
  }, [active]);

  const stop = useCallback(() => {
    if (timerRef.current !== null) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
  }, []);

  const start = useCallback((vid: HTMLVideoElement) => {
    stop();

    if (!canvasRef.current) {
      canvasRef.current = document.createElement("canvas");
    }
    const canvas = canvasRef.current;
    canvas.width = FRAME_W;
    canvas.height = FRAME_H;
    const ctx = canvas.getContext("2d")!;

    const ws = new WebSocket(getWsCamUrl());
    ws.binaryType = "arraybuffer";
    wsRef.current = ws;

    let wsReady = false;
    ws.onopen = () => { wsReady = true; };
    ws.onclose = () => { wsReady = false; };
    ws.onerror = () => { wsReady = false; };

    timerRef.current = window.setInterval(() => {
      if (!activeRef.current || !wsReady || ws.readyState !== WebSocket.OPEN) return;
      if (!vid || vid.readyState < 2) return;

      ctx.drawImage(vid, 0, 0, FRAME_W, FRAME_H);

      canvas.toBlob(
        (blob) => {
          if (!blob || !wsReady || ws.readyState !== WebSocket.OPEN) return;
          blob.arrayBuffer().then((buf) => {
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(buf);
            }
          });
        },
        "image/jpeg",
        JPEG_QUALITY,
      );
    }, INTERVAL_MS);
  }, [stop]);

  useEffect(() => {
    if (active && videoEl) {
      start(videoEl);
    } else {
      stop();
    }
    return stop;
  }, [active, videoEl, start, stop]);
}
