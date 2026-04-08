/**
 * useCamProcessor
 * ───────────────
 * Captures frames from a <video> element (live webcam) and sends them as
 * JPEG binary over /ws/cam to the backend for YOLO+SORT processing.
 *
 * Latency-free design:
 * • Only one frame is encoded at a time (encoding flag prevents cascade).
 * • Skips encoding if the WebSocket output buffer is growing (backpressure).
 * • Sends at ~5 fps — matched to what CPU YOLO can actually process.
 *   Sending faster just stacks frames in buffers and adds delay.
 *
 * Accepts a React.RefObject<HTMLVideoElement | null> so the ref identity
 * stays stable across re-renders — avoids spurious restarts.
 */
import { useEffect, useRef, useCallback, RefObject } from "react";

const FRAME_W  = 640;
const FRAME_H  = 360;
const JPEG_QUALITY = 0.60;  // lower = smaller upload per frame = less lag on slow sources (DroidCam)
const INTERVAL_MS  = 200;   // 5 fps — matches CPU YOLO throughput
const WS_BACKLOG   = 32_000; // bytes — tighter backpressure: drop frames sooner to stay real-time
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

    let encoding = false; // prevents toBlob cascade when encoding is slower than interval

    timerRef.current = window.setInterval(() => {
      if (!activeRef.current) return;
      if (ws.readyState !== WebSocket.OPEN) return;
      if (!vid || vid.readyState < 2) return;

      // Backpressure guard: skip this frame if the WebSocket is backed up.
      // This is the primary defence against growing delay — if the backend
      // is slower than our send rate, the OS buffer grows. Once it exceeds
      // WS_BACKLOG we drop frames until it drains back down.
      if (ws.bufferedAmount > WS_BACKLOG) return;

      // Encoding guard: only one toBlob in-flight at a time.
      // Without this, every interval schedules another toBlob even while the
      // previous one is still encoding, creating a cascade of pending frames.
      if (encoding) return;
      encoding = true;

      ctx.drawImage(vid, 0, 0, FRAME_W, FRAME_H);
      canvas.toBlob(
        (blob) => {
          encoding = false;
          if (!blob || ws.readyState !== WebSocket.OPEN) return;
          if (ws.bufferedAmount > WS_BACKLOG) return; // re-check after encode
          blob.arrayBuffer().then((buf) => {
            if (ws.readyState === WebSocket.OPEN && ws.bufferedAmount <= WS_BACKLOG) {
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
