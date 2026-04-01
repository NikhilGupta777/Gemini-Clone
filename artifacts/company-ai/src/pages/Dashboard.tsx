import { useRef, useState, useCallback, useEffect } from "react";
import { useDetection } from "../context/DetectionContext";
import { useAlertSound } from "../hooks/useAlertSound";
import { useCamProcessor } from "../hooks/useCamProcessor";
import SimulationCanvas from "../components/SimulationCanvas";
import StatsCards from "../components/StatsCards";
import AlertsFeed from "../components/AlertsFeed";
import {
  Camera, Monitor, Cpu, Users, Package,
  AlertTriangle, Activity, Upload, Video, StopCircle,
  CheckCircle, Loader, Volume2, VolumeX, Radio, Link, X,
} from "lucide-react";

interface VideoStatusData {
  mode: string;
  filename: string | null;
  progress: number;
  total_frames: number;
  current_frame: number;
  model_ready: boolean;
  model_error: string | null;
  error: string | null;
}

interface StreamStatusData {
  active: boolean;
  url: string | null;
  error: string | null;
  model_ready: boolean;
  model_error: string | null;
}

interface WebcamStatusData {
  active: boolean;
  error: string | null;
  model_ready: boolean;
  model_error: string | null;
}

const PILL_STYLE = {
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 10,
  padding: "10px 18px",
  display: "flex",
  alignItems: "center",
  gap: 10,
  flex: 1,
};

type ActivePanel = "none" | "video" | "stream";
type SourceMode = "idle" | "webcam" | "video" | "stream";

export default function Dashboard() {
  const { frame, connected } = useDetection();

  const [sourceMode, setSourceMode] = useState<SourceMode>("idle");
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [activePanel, setActivePanel] = useState<ActivePanel>("none");

  const [videoStatus, setVideoStatus] = useState<VideoStatusData | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const [streamStatus, setStreamStatus] = useState<StreamStatusData | null>(null);
  const [streamUrl, setStreamUrl] = useState("");
  const [streamError, setStreamError] = useState<string | null>(null);

  const [webcamStatus, setWebcamStatus] = useState<WebcamStatusData | null>(null);

  const videoElRef = useRef<HTMLVideoElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const tracks = frame?.tracks ?? [];
  const anomalies = frame?.anomalies ?? [];
  const stats = frame?.stats ?? null;
  const displayMode = (frame?.mode as SourceMode) ?? sourceMode;

  useAlertSound(anomalies, soundEnabled);

  useCamProcessor(
    sourceMode === "webcam" ? videoElRef : null,
    sourceMode === "webcam",
  );

  // Poll video status — no dependencies so interval is stable
  useEffect(() => {
    const poll = async () => {
      try {
        const res = await fetch("/api/video/status");
        const data = await res.json();
        setVideoStatus(data);
      } catch {}
    };
    poll();
    const id = setInterval(poll, 1500);
    return () => clearInterval(id);
  }, []);

  // Poll stream status — stable interval; auto-reset mode when stream errors out
  useEffect(() => {
    const poll = async () => {
      try {
        const res = await fetch("/api/stream/status");
        const data = await res.json();
        setStreamStatus(data);
        // If backend says stream stopped with error, reset our UI state
        if (data.error && !data.active) {
          setSourceMode(prev => prev === "stream" ? "idle" : prev);
        }
      } catch {}
    };
    poll();
    const id = setInterval(poll, 2000);
    return () => clearInterval(id);
  }, []);

  // Poll webcam status — stable interval, no sourceMode dependency
  useEffect(() => {
    const poll = async () => {
      try {
        const res = await fetch("/api/webcam/status");
        const data = await res.json();
        setWebcamStatus(data);
      } catch {}
    };
    poll();
    const id = setInterval(poll, 2000);
    return () => clearInterval(id);
  }, []);

  // ── Webcam ──────────────────────────────────────────────────────────────────

  const enableCamera = useCallback(async () => {
    setCameraError(null);
    try {
      // Stop any existing tracks
      mediaStreamRef.current?.getTracks().forEach(t => t.stop());

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      mediaStreamRef.current = stream;

      // Reuse existing video element or create once
      if (!videoElRef.current) {
        const vid = document.createElement("video");
        vid.muted = true;
        vid.playsInline = true;
        vid.autoplay = true;
        videoElRef.current = vid;
      }
      videoElRef.current.srcObject = stream;
      await videoElRef.current.play();

      const res = await fetch("/api/webcam/start", { method: "POST" });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.detail ?? "Could not start webcam processing");
      }

      setSourceMode("webcam");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Camera access denied";
      setCameraError(msg);
      mediaStreamRef.current?.getTracks().forEach(t => t.stop());
      mediaStreamRef.current = null;
    }
  }, []);

  const disableCamera = useCallback(async () => {
    mediaStreamRef.current?.getTracks().forEach(t => t.stop());
    mediaStreamRef.current = null;
    if (videoElRef.current) {
      videoElRef.current.srcObject = null;
    }
    await fetch("/api/webcam/stop", { method: "POST" }).catch(() => {});
    setSourceMode("idle");
    setCameraError(null);
  }, []);

  // ── Video upload ─────────────────────────────────────────────────────────────

  const handleFileUpload = async (file: File) => {
    setUploading(true);
    setUploadError(null);
    const form = new FormData();
    form.append("file", file);
    try {
      const res = await fetch("/api/video/upload", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail ?? "Upload failed");
    } catch (e: unknown) {
      setUploadError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const startVideoProcessing = async () => {
    const res = await fetch("/api/video/start", { method: "POST" });
    if (!res.ok) {
      const d = await res.json();
      setUploadError(d.detail);
    } else {
      setSourceMode("video");
    }
  };

  const stopVideoProcessing = async () => {
    await fetch("/api/video/stop", { method: "POST" });
    setSourceMode("idle");
  };

  // ── Stream ────────────────────────────────────────────────────────────────────

  const startStream = async () => {
    setStreamError(null);
    if (!streamUrl.trim()) { setStreamError("Enter a stream URL first"); return; }
    try {
      const res = await fetch("/api/stream/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: streamUrl.trim() }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.detail ?? "Could not start stream");
      setSourceMode("stream");
    } catch (e: unknown) {
      setStreamError(e instanceof Error ? e.message : "Stream error");
    }
  };

  const stopStream = async () => {
    await fetch("/api/stream/stop", { method: "POST" });
    setSourceMode("idle");
  };

  const isVideoProcessing = videoStatus?.mode === "processing";
  const hasUpload = !!(videoStatus?.filename && videoStatus?.mode !== "idle");
  const isStreaming = streamStatus?.active === true || sourceMode === "stream";
  const modelReady = videoStatus?.model_ready ?? false;
  const modelError = videoStatus?.model_error ?? null;

  const metricPills = [
    { icon: Users,         label: "PERSONS",      value: stats?.person_count ?? 0,  color: "#3b82f6" },
    { icon: Package,       label: "OBJECTS",       value: stats?.object_count ?? 0,  color: "#f59e0b" },
    { icon: AlertTriangle, label: "ANOMALIES",     value: anomalies.length,          color: anomalies.length > 0 ? "#ef4444" : "#10b981" },
    { icon: Activity,      label: "ACTIVE TRACKS", value: tracks.length,             color: "#a855f7" },
  ];

  const modeBadge = (() => {
    if (displayMode === "video")  return { label: "VIDEO DETECT · YOLO", color: "#a855f7", icon: Video };
    if (displayMode === "webcam") return { label: "WEBCAM · LIVE YOLO",  color: "#10b981", icon: Camera };
    if (displayMode === "stream") return { label: "STREAM · LIVE YOLO",  color: "#f59e0b", icon: Radio };
    return { label: "AWAITING INPUT",  color: "#475569", icon: Monitor };
  })();

  return (
    <div>
      {/* ── Hidden file input — always mounted so file picker works ── */}
      <input
        ref={fileInputRef}
        type="file"
        accept="video/*"
        style={{ display: "none" }}
        onChange={e => {
          const f = e.target.files?.[0];
          if (f) handleFileUpload(f);
          // Reset so the same file can be re-selected
          e.target.value = "";
        }}
      />

      {/* ── Header ── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 22, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "#f1f5f9", letterSpacing: -0.5, marginBottom: 4 }}>
            Live Surveillance Dashboard
          </h1>
          <p style={{ color: "#475569", fontSize: 13 }}>
            {displayMode === "video"  && "YOLOv8n + SORT — processing uploaded video"}
            {displayMode === "webcam" && "YOLOv8n + SORT — real-time webcam detection"}
            {displayMode === "stream" && `YOLOv8n + SORT — live stream: ${streamStatus?.url ?? ""}`}
            {(displayMode === "idle" || !displayMode) && "Select a source below — webcam, video upload, or live stream"}
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          {/* Sound toggle */}
          <button
            onClick={() => setSoundEnabled(v => !v)}
            style={{
              display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 8,
              border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.04)",
              color: soundEnabled ? "#10b981" : "#475569", cursor: "pointer", fontSize: 12, fontWeight: 600,
            }}
          >
            {soundEnabled ? <Volume2 size={14} /> : <VolumeX size={14} />}
            {soundEnabled ? "Sound ON" : "Sound OFF"}
          </button>

          {/* Webcam button */}
          {cameraError && (
            <span style={{ fontSize: 11, color: "#ef4444", maxWidth: 160 }}>{cameraError}</span>
          )}
          <button
            onClick={sourceMode === "webcam" ? disableCamera : enableCamera}
            disabled={isVideoProcessing || isStreaming}
            style={{
              display: "flex", alignItems: "center", gap: 8, padding: "8px 16px", borderRadius: 8,
              border: "1px solid", cursor: (isVideoProcessing || isStreaming) ? "not-allowed" : "pointer",
              fontSize: 12, fontWeight: 600, transition: "all 0.2s",
              borderColor: sourceMode === "webcam" ? "#10b981" : "rgba(255,255,255,0.12)",
              background: sourceMode === "webcam" ? "rgba(16,185,129,0.12)" : "rgba(255,255,255,0.04)",
              color: sourceMode === "webcam" ? "#10b981" : "#94a3b8",
              opacity: (isVideoProcessing || isStreaming) ? 0.4 : 1,
            }}
          >
            {sourceMode === "webcam" ? (
              webcamStatus?.active
                ? <><div style={{ width: 7, height: 7, borderRadius: "50%", background: "#10b981", boxShadow: "0 0 6px #10b981", animation: "pulse-ring 1.4s infinite" }} /> YOLO LIVE</>
                : <><Loader size={14} style={{ animation: "spin 1s linear infinite" }} /> YOLO Starting…</>
            ) : <><Camera size={14} /> Live Webcam</>}
          </button>

          {/* Video upload button */}
          <button
            onClick={() => setActivePanel(p => p === "video" ? "none" : "video")}
            style={{
              display: "flex", alignItems: "center", gap: 8, padding: "8px 16px", borderRadius: 8,
              border: "1px solid", cursor: "pointer", fontSize: 12, fontWeight: 600,
              borderColor: activePanel === "video" || isVideoProcessing ? "#a855f7" : "rgba(255,255,255,0.12)",
              background: activePanel === "video" || isVideoProcessing ? "rgba(168,85,247,0.12)" : "rgba(255,255,255,0.04)",
              color: activePanel === "video" || isVideoProcessing ? "#a855f7" : "#94a3b8",
            }}
          >
            <Video size={14} />
            {isVideoProcessing ? "Video Running" : "Upload Video"}
          </button>

          {/* Stream button */}
          <button
            onClick={() => setActivePanel(p => p === "stream" ? "none" : "stream")}
            style={{
              display: "flex", alignItems: "center", gap: 8, padding: "8px 16px", borderRadius: 8,
              border: "1px solid", cursor: "pointer", fontSize: 12, fontWeight: 600,
              borderColor: activePanel === "stream" || isStreaming ? "#f59e0b" : "rgba(255,255,255,0.12)",
              background: activePanel === "stream" || isStreaming ? "rgba(245,158,11,0.1)" : "rgba(255,255,255,0.04)",
              color: activePanel === "stream" || isStreaming ? "#f59e0b" : "#94a3b8",
            }}
          >
            <Radio size={14} />
            {isStreaming ? "Stream Active" : "Live Stream"}
          </button>

          {/* Mode badge */}
          <div style={{
            padding: "8px 14px", borderRadius: 8, border: `1px solid ${modeBadge.color}33`,
            background: `${modeBadge.color}10`, display: "flex", alignItems: "center",
            gap: 6, fontSize: 11, color: modeBadge.color, fontWeight: 700,
          }}>
            <modeBadge.icon size={13} />
            {modeBadge.label}
          </div>
        </div>
      </div>

      {/* ── Video Upload Panel ── */}
      {activePanel === "video" && (
        <div style={{
          background: "rgba(168,85,247,0.05)", border: "1px solid rgba(168,85,247,0.2)",
          borderRadius: 14, padding: 20, marginBottom: 20,
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <div style={{ fontSize: 9, color: "#a855f7", letterSpacing: 2, fontWeight: 700 }}>
              YOLOv8n REAL DETECTION · UPLOAD VIDEO FILE
            </div>
            <button onClick={() => setActivePanel("none")} style={{ background: "none", border: "none", cursor: "pointer", color: "#475569" }}>
              <X size={16} />
            </button>
          </div>

          {/* Model status */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16, fontSize: 11 }}>
            {modelReady ? (
              <><CheckCircle size={13} color="#10b981" /><span style={{ color: "#10b981" }}>YOLOv8n ready</span></>
            ) : modelError ? (
              <><X size={13} color="#ef4444" /><span style={{ color: "#ef4444" }}>Model error: {modelError}</span></>
            ) : (
              <><Loader size={13} color="#f59e0b" style={{ animation: "spin 1s linear infinite" }} />
              <span style={{ color: "#f59e0b" }}>Loading YOLOv8n (~6 MB, one-time download)…</span></>
            )}
          </div>

          {!isVideoProcessing && (
            <div
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={e => {
                e.preventDefault();
                setDragOver(false);
                const f = e.dataTransfer.files[0];
                if (f) handleFileUpload(f);
              }}
              onClick={() => fileInputRef.current?.click()}
              style={{
                border: `2px dashed ${dragOver ? "#a855f7" : "rgba(168,85,247,0.3)"}`,
                borderRadius: 10, padding: "24px 20px", textAlign: "center",
                cursor: "pointer", transition: "border-color 0.2s",
                background: dragOver ? "rgba(168,85,247,0.08)" : "transparent", marginBottom: 12,
              }}
            >
              <Upload size={24} color="#a855f7" style={{ margin: "0 auto 8px", display: "block" }} />
              <div style={{ color: "#94a3b8", fontSize: 13 }}>
                {uploading
                  ? "Uploading…"
                  : (videoStatus?.filename && hasUpload)
                    ? <><span style={{ color: "#a855f7", fontWeight: 600 }}>{videoStatus.filename}</span> · ready to process</>
                    : "Drop video here or click to browse"
                }
              </div>
              <div style={{ fontSize: 11, color: "#334155", marginTop: 4 }}>MP4, AVI, MOV, MKV · max 500 MB</div>
            </div>
          )}

          {uploadError && (
            <div style={{ color: "#ef4444", fontSize: 12, marginBottom: 10 }}>{uploadError}</div>
          )}

          {isVideoProcessing && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#64748b", marginBottom: 6 }}>
                <span>{videoStatus?.filename}</span>
                <span>{videoStatus?.progress?.toFixed(1)}% · frame {videoStatus?.current_frame}/{videoStatus?.total_frames}</span>
              </div>
              <div style={{ height: 6, background: "rgba(255,255,255,0.06)", borderRadius: 3 }}>
                <div style={{
                  height: "100%", borderRadius: 3, width: `${videoStatus?.progress ?? 0}%`,
                  background: "linear-gradient(90deg,#7c3aed,#a855f7)", transition: "width 0.5s",
                }} />
              </div>
            </div>
          )}

          {videoStatus?.error && (
            <div style={{ color: "#ef4444", fontSize: 12, marginBottom: 10 }}>Error: {videoStatus.error}</div>
          )}

          <div style={{ display: "flex", gap: 10 }}>
            {!isVideoProcessing && hasUpload && (
              <button onClick={startVideoProcessing} disabled={!modelReady} style={{
                display: "flex", alignItems: "center", gap: 8, padding: "8px 18px", borderRadius: 8,
                border: "none", cursor: modelReady ? "pointer" : "not-allowed",
                background: modelReady ? "linear-gradient(135deg,#7c3aed,#a855f7)" : "#1e1b4b",
                color: "#fff", fontWeight: 700, fontSize: 13,
              }}>
                <Video size={14} /> Start Real Detection
              </button>
            )}
            {isVideoProcessing && (
              <button onClick={stopVideoProcessing} style={{
                display: "flex", alignItems: "center", gap: 8, padding: "8px 18px", borderRadius: 8,
                border: "none", cursor: "pointer", background: "rgba(239,68,68,0.15)",
                color: "#ef4444", fontWeight: 700, fontSize: 13, outline: "1px solid rgba(239,68,68,0.3)",
              }}>
                <StopCircle size={14} /> Stop Processing
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Stream Panel ── */}
      {activePanel === "stream" && (
        <div style={{
          background: "rgba(245,158,11,0.04)", border: "1px solid rgba(245,158,11,0.2)",
          borderRadius: 14, padding: 20, marginBottom: 20,
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <div style={{ fontSize: 9, color: "#f59e0b", letterSpacing: 2, fontWeight: 700 }}>
              LIVE STREAM DETECTION · RTSP / HTTP / IP CAMERA
            </div>
            <button onClick={() => setActivePanel("none")} style={{ background: "none", border: "none", cursor: "pointer", color: "#475569" }}>
              <X size={16} />
            </button>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16, fontSize: 11 }}>
            {streamStatus?.model_ready ? (
              <><CheckCircle size={13} color="#10b981" /><span style={{ color: "#10b981" }}>YOLOv8n ready</span></>
            ) : streamStatus?.model_error ? (
              <><X size={13} color="#ef4444" /><span style={{ color: "#ef4444" }}>Model error: {streamStatus.model_error}</span></>
            ) : (
              <><Loader size={13} color="#f59e0b" style={{ animation: "spin 1s linear infinite" }} />
              <span style={{ color: "#f59e0b" }}>Loading YOLOv8n…</span></>
            )}
          </div>

          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 11, color: "#64748b", marginBottom: 8 }}>
              Enter any video stream URL — RTSP, HTTP, or an IP camera. Examples:
            </div>
            <div style={{ fontSize: 10, color: "#334155", marginBottom: 10, lineHeight: 1.8 }}>
              <code style={{ color: "#f59e0b" }}>rtsp://192.168.1.100:554/stream</code> — IP camera (RTSP)<br />
              <code style={{ color: "#f59e0b" }}>http://IP:PORT/video</code> — HTTP MJPEG camera<br />
              <code style={{ color: "#f59e0b" }}>rtsp://user:pass@IP:554/stream</code> — with authentication
            </div>
            <button
              onClick={() => setStreamUrl("http://localhost:8080/api/stream/test-feed")}
              style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                marginBottom: 12, padding: "5px 12px", borderRadius: 6,
                border: "1px solid rgba(16,185,129,0.3)", background: "rgba(16,185,129,0.08)",
                color: "#10b981", fontSize: 11, fontWeight: 600, cursor: "pointer",
              }}
            >
              ⚡ Fill built-in test stream URL
            </button>
            <div style={{ display: "flex", gap: 8 }}>
              <div style={{ position: "relative", flex: 1 }}>
                <Link size={13} color="#64748b" style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)" }} />
                <input
                  type="text"
                  value={streamUrl}
                  onChange={e => setStreamUrl(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && !isStreaming && startStream()}
                  placeholder="rtsp:// or http:// stream URL"
                  disabled={isStreaming}
                  style={{
                    width: "100%", padding: "9px 12px 9px 32px", borderRadius: 8, boxSizing: "border-box",
                    background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)",
                    color: "#f1f5f9", fontSize: 12, outline: "none",
                  }}
                />
              </div>
              {!isStreaming ? (
                <button onClick={startStream} disabled={!streamStatus?.model_ready} style={{
                  display: "flex", alignItems: "center", gap: 8, padding: "9px 18px", borderRadius: 8,
                  border: "none", cursor: streamStatus?.model_ready ? "pointer" : "not-allowed",
                  background: streamStatus?.model_ready ? "linear-gradient(135deg,#d97706,#f59e0b)" : "#1c1a10",
                  color: "#fff", fontWeight: 700, fontSize: 13, whiteSpace: "nowrap",
                }}>
                  <Radio size={14} /> Connect
                </button>
              ) : (
                <button onClick={stopStream} style={{
                  display: "flex", alignItems: "center", gap: 8, padding: "9px 18px", borderRadius: 8,
                  border: "none", cursor: "pointer", background: "rgba(239,68,68,0.15)",
                  color: "#ef4444", fontWeight: 700, fontSize: 13, outline: "1px solid rgba(239,68,68,0.3)",
                  whiteSpace: "nowrap",
                }}>
                  <StopCircle size={14} /> Disconnect
                </button>
              )}
            </div>
          </div>

          {streamError && <div style={{ color: "#ef4444", fontSize: 12, marginTop: 8 }}>{streamError}</div>}
          {streamStatus?.error && <div style={{ color: "#ef4444", fontSize: 12, marginTop: 8 }}>Stream error: {streamStatus.error}</div>}

          {isStreaming && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10, fontSize: 11 }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#f59e0b", boxShadow: "0 0 8px #f59e0b", animation: "pulse-ring 1.4s infinite" }} />
              <span style={{ color: "#f59e0b" }}>Stream active — processing with YOLOv8n</span>
            </div>
          )}
        </div>
      )}

      {/* ── Main grid ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 310px", gap: 20, alignItems: "start" }}>
        <div>
          <div style={{
            borderRadius: 14, border: "1px solid rgba(255,255,255,0.08)", overflow: "hidden",
            background: "#060a12", position: "relative",
            boxShadow: "0 20px 60px rgba(0,0,0,0.6), 0 0 0 1px rgba(59,130,246,0.1)",
          }}>
            {!connected && (
              <div style={{
                position: "absolute", inset: 0, background: "rgba(6,10,18,0.88)",
                display: "flex", alignItems: "center", justifyContent: "center",
                flexDirection: "column", gap: 14, zIndex: 10, backdropFilter: "blur(4px)",
              }}>
                <Cpu size={36} color="#1e3a5f" />
                <div style={{ color: "#334155", fontSize: 14, fontWeight: 600 }}>Connecting to detection engine…</div>
                <div style={{ display: "flex", gap: 6 }}>
                  {[0, 1, 2].map(i => (
                    <div key={i} style={{
                      width: 8, height: 8, borderRadius: "50%", background: "#1e40af",
                      animation: `bounce-dot 1.2s ${i * 0.2}s infinite`,
                    }} />
                  ))}
                </div>
              </div>
            )}
            <SimulationCanvas
              tracks={tracks}
              anomalies={anomalies}
              cameraMode={sourceMode === "webcam" ? "webcam" : "idle"}
              videoRef={videoElRef}
              sourceMode={displayMode}
              frameJpeg={frame?.frame_jpeg}
            />
          </div>

          {/* Metric pills */}
          <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
            {metricPills.map(({ icon: Icon, label, value, color }) => (
              <div key={label} style={PILL_STYLE}>
                <Icon size={16} color={color} style={{ flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: 22, fontWeight: 800, color, lineHeight: 1.2 }}>{value}</div>
                  <div style={{ fontSize: 9, color: "#475569", fontWeight: 700, letterSpacing: 1.5, marginTop: 2 }}>
                    {label}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right sidebar */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <StatsCards stats={stats} anomalyCount={anomalies.length} />
          <AlertsFeed anomalies={anomalies} />
        </div>
      </div>

      <style>{`
        @keyframes bounce-dot {
          0%, 80%, 100% { transform: scale(0.8); opacity: 0.4; }
          40% { transform: scale(1.2); opacity: 1; }
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse-ring {
          0% { box-shadow: 0 0 0 0 rgba(245,158,11,0.7); }
          70% { box-shadow: 0 0 0 6px rgba(245,158,11,0); }
          100% { box-shadow: 0 0 0 0 rgba(245,158,11,0); }
        }
      `}</style>
    </div>
  );
}
