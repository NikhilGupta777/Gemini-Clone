/**
 * useCamProcessor
 * ───────────────
 * Captures frames from a <video> element (live webcam) every ~100ms,
 * encodes them as JPEG and sends binary over /ws/cam to the backend.
 * The backend runs YOLO+SORT and broadcasts results via /ws to all clients.
 *
 * Accepts a React.RefObject<HTMLVideoElement | null> so the ref identity
 * stays stable across re-renders — avoids spurious restarts.
 */
import { useEffect, useRef, useCallback, RefObject } from "react";

const FRAME_W = 640;
const FRAME_H = 360;
const JPEG_QUALITY = 0.7;
const INTERVAL_MS = 100; // ~10 fps to backend
const RECONNECT_DELAY_MS = 1500;

function getWsCamUrl() {
  const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${proto}//${window.location.host}/ws/cam`;
}

export function useCamProcessor(
  videoRef: RefObject<HTMLVideoElement | null> | null,
  active: boolean,
) {
  const wsRef = useRef<WebSocket | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const timerRef = useRef<number | null>(null);
  const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeRef = useRef(active);

  useEffect(() => {
    activeRef.current = active;
  }, [active]);

  const clearReconnect = useCallback(() => {
    if (reconnectRef.current !== null) {
      clearTimeout(reconnectRef.current);
      reconnectRef.current = null;
    }
  }, []);

  const stopFrameLoop = useCallback(() => {
    if (timerRef.current !== null) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const closeWs = useCallback(() => {
    if (wsRef.current) {
      // Remove handlers before closing to prevent triggering reconnect
      wsRef.current.onclose = null;
      wsRef.current.onerror = null;
      wsRef.current.close();
      wsRef.current = null;
    }
  }, []);

  const stop = useCallback(() => {
    clearReconnect();
    stopFrameLoop();
    closeWs();
  }, [clearReconnect, stopFrameLoop, closeWs]);

  const startFrameLoop = useCallback((vid: HTMLVideoElement, ws: WebSocket) => {
    stopFrameLoop();

    if (!canvasRef.current) {
      canvasRef.current = document.createElement("canvas");
    }
    const canvas = canvasRef.current;
    canvas.width = FRAME_W;
    canvas.height = FRAME_H;
    const ctx = canvas.getContext("2d")!;

    timerRef.current = window.setInterval(() => {
      if (!activeRef.current) return;
      if (ws.readyState !== WebSocket.OPEN) return;
      if (!vid || vid.readyState < 2) return;

      ctx.drawImage(vid, 0, 0, FRAME_W, FRAME_H);
      canvas.toBlob(
        (blob) => {
          if (!blob || ws.readyState !== WebSocket.OPEN) return;
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
  }, [stopFrameLoop]);

  const connectWs = useCallback(() => {
    clearReconnect();
    if (!activeRef.current) return;

    const vid = videoRef?.current;
    if (!vid) return;

    closeWs();
    const ws = new WebSocket(getWsCamUrl());
    ws.binaryType = "arraybuffer";
    wsRef.current = ws;

    ws.onopen = () => {
      if (!activeRef.current) {
        ws.close();
        return;
      }
      startFrameLoop(vid, ws);
    };

    ws.onclose = () => {
      stopFrameLoop();
      if (activeRef.current) {
        // Auto-reconnect while webcam is still supposed to be active
        reconnectRef.current = setTimeout(() => {
          if (activeRef.current) connectWs();
        }, RECONNECT_DELAY_MS);
      }
    };

    ws.onerror = () => {
      ws.close(); // onclose will handle reconnect
    };
  }, [videoRef, clearReconnect, closeWs, startFrameLoop, stopFrameLoop]);

  useEffect(() => {
    if (active && videoRef) {
      // Small delay to ensure video element has a stream attached
      const t = setTimeout(connectWs, 200);
      return () => {
        clearTimeout(t);
        stop();
      };
    }
    stop();
    return undefined;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  // Cleanup on unmount
  useEffect(() => {
    return stop;
  }, [stop]);
}
