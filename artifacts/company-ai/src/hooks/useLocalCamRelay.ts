/**
 * useLocalCamRelay
 * ────────────────
 * Relays frames from a local IP camera (MJPEG stream or JPEG snapshot URL)
 * to the CrowdLens backend via /ws/cam — the same WebSocket used by the USB
 * webcam mode.  The browser is the bridge: it loads the camera URL, captures
 * frames using a canvas, and sends JPEG blobs to the backend for YOLO+SORT.
 *
 * Why browser-side relay?
 * The CrowdLens backend runs in the cloud (Replit) and cannot reach cameras
 * on your local network (192.168.x.x etc.).  The browser, however, runs on
 * your machine and CAN reach those cameras.  We exploit that to relay frames.
 *
 * Limitation: the camera must send Cross-Origin headers (CORS) for canvas
 * pixel capture to work.  Many IP cameras do not.  In that case we surface a
 * clear error message.
 */
import { useCallback, useRef, useState } from "react";

const FRAME_W = 640;
const FRAME_H = 360;
const JPEG_QUALITY = 0.72;
const CAPTURE_MS = 150; // ~6-7 fps to backend
const RECONNECT_MS = 2000;

function getWsCamUrl() {
  const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${proto}//${window.location.host}/ws/cam`;
}

export type RelayState = "idle" | "connecting" | "active" | "error";

export function useLocalCamRelay() {
  const [state, setState] = useState<RelayState>("idle");
  const [error, setError] = useState<string | null>(null);

  const wsRef        = useRef<WebSocket | null>(null);
  const canvasRef    = useRef<HTMLCanvasElement | null>(null);
  const timerRef     = useRef<number | null>(null);
  const activeRef    = useRef(false);
  const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = () => {
    if (timerRef.current !== null) { clearInterval(timerRef.current); timerRef.current = null; }
  };
  const clearReconnect = () => {
    if (reconnectRef.current !== null) { clearTimeout(reconnectRef.current); reconnectRef.current = null; }
  };

  const stop = useCallback(() => {
    activeRef.current = false;
    clearTimer();
    clearReconnect();
    if (wsRef.current) {
      wsRef.current.onclose = null;
      wsRef.current.onerror = null;
      wsRef.current.close();
      wsRef.current = null;
    }
    setState("idle");
    setError(null);
  }, []);

  const _captureFrame = (src: HTMLImageElement | HTMLVideoElement, ws: WebSocket) => {
    if (!canvasRef.current) return;
    const ctx = canvasRef.current.getContext("2d");
    if (!ctx) return;
    try {
      ctx.drawImage(src, 0, 0, FRAME_W, FRAME_H);
      canvasRef.current.toBlob(blob => {
        if (!blob || ws.readyState !== WebSocket.OPEN) return;
        blob.arrayBuffer().then(buf => {
          if (ws.readyState === WebSocket.OPEN) ws.send(buf);
        });
      }, "image/jpeg", JPEG_QUALITY);
    } catch (e) {
      if (e instanceof DOMException && e.name === "SecurityError") {
        setError(
          "CORS blocked: the camera did not send Access-Control-Allow-Origin headers, " +
          "so the browser cannot read its pixels.\n\n" +
          "Fix on the camera admin page: enable CORS / cross-origin access. " +
          "Or try the camera's JPEG snapshot URL instead of the MJPEG stream."
        );
        stop();
      }
    }
  };

  const _startRelay = (url: string, ws: WebSocket) => {
    if (!canvasRef.current) {
      canvasRef.current = document.createElement("canvas");
    }
    canvasRef.current.width  = FRAME_W;
    canvasRef.current.height = FRAME_H;

    const isSnapshot = /\.(jpe?g|png)(\?|$)/i.test(url) || /snapshot|capture|jpg/i.test(url);

    if (isSnapshot) {
      // Repeatedly fetch a fresh JPEG snapshot
      timerRef.current = window.setInterval(() => {
        if (!activeRef.current || ws.readyState !== WebSocket.OPEN) return;
        const cacheBust = url.includes("?") ? `${url}&_t=${Date.now()}` : `${url}?_t=${Date.now()}`;
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => _captureFrame(img, ws);
        img.onerror = () => {/* network hiccup — try again next tick */};
        img.src = cacheBust;
      }, CAPTURE_MS * 2); // snapshots are slower — 3-4 fps is fine
    } else {
      // MJPEG stream: load once in <img>, drawImage repeatedly
      const mjpegImg = new Image();
      mjpegImg.crossOrigin = "anonymous";
      mjpegImg.src = url;
      timerRef.current = window.setInterval(() => {
        if (!activeRef.current || ws.readyState !== WebSocket.OPEN) return;
        if (mjpegImg.complete && mjpegImg.naturalWidth > 0) {
          _captureFrame(mjpegImg, ws);
        }
      }, CAPTURE_MS);
    }

    setState("active");
  };

  const _connectWs = useCallback((url: string) => {
    clearReconnect();
    if (!activeRef.current) return;
    clearTimer();
    if (wsRef.current) {
      wsRef.current.onclose = null;
      wsRef.current.close();
      wsRef.current = null;
    }

    setState("connecting");
    const ws = new WebSocket(getWsCamUrl());
    ws.binaryType = "arraybuffer";
    wsRef.current = ws;

    ws.onopen = () => {
      if (!activeRef.current) { ws.close(); return; }
      _startRelay(url, ws);
    };

    ws.onclose = () => {
      clearTimer();
      if (activeRef.current) {
        setState("connecting");
        reconnectRef.current = setTimeout(() => {
          if (activeRef.current) _connectWs(url);
        }, RECONNECT_MS);
      }
    };

    ws.onerror = () => { ws.close(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stop]);

  const start = useCallback(async (
    url: string,
    startBackend: () => Promise<void>,
  ) => {
    stop();
    setError(null);
    setState("connecting");
    activeRef.current = true;

    try {
      await startBackend();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start backend processing");
      setState("error");
      activeRef.current = false;
      return;
    }

    _connectWs(url);
  }, [stop, _connectWs]);

  return { state, error, start, stop };
}
