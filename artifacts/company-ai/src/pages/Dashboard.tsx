import { useRef, useState, useCallback, useEffect } from "react";
import { FrameData } from "../hooks/useSimulation";
import { useAlertSound } from "../hooks/useAlertSound";
import SimulationCanvas from "../components/SimulationCanvas";
import StatsCards from "../components/StatsCards";
import AlertsFeed from "../components/AlertsFeed";
import {
  Camera, CameraOff, Monitor, Cpu, Users, Package,
  AlertTriangle, Activity, Upload, Video, StopCircle,
  CheckCircle, Loader, Volume2, VolumeX,
} from "lucide-react";

interface Props {
  frame: FrameData | null;
  connected: boolean;
}

type CameraMode = "simulation" | "webcam";

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

export default function Dashboard({ frame, connected }: Props) {
  const [cameraMode, setCameraMode] = useState<CameraMode>("simulation");
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [showVideoPanel, setShowVideoPanel] = useState(false);
  const [videoStatus, setVideoStatus] = useState<VideoStatusData | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const tracks = frame?.tracks ?? [];
  const anomalies = frame?.anomalies ?? [];
  const stats = frame?.stats ?? null;
  const sourceMode = frame?.mode ?? "simulation";

  useAlertSound(anomalies, soundEnabled);

  // Poll video status
  useEffect(() => {
    const poll = async () => {
      try {
        const res = await fetch("/api/video/status");
        const data = await res.json();
        setVideoStatus(data);
      } catch {}
    };
    poll();
    const interval = setInterval(poll, 1500);
    return () => clearInterval(interval);
  }, []);

  const enableCamera = useCallback(async () => {
    setCameraError(null);
    try {
      streamRef.current?.getTracks().forEach(t => t.stop());
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      streamRef.current = stream;
      if (!videoRef.current) {
        videoRef.current = document.createElement("video");
        videoRef.current.muted = true;
        videoRef.current.playsInline = true;
      }
      videoRef.current.srcObject = stream;
      await videoRef.current.play();
      setCameraMode("webcam");
    } catch (err: any) {
      setCameraError(err.message ?? "Camera access denied");
    }
  }, []);

  const disableCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraMode("simulation");
    setCameraError(null);
  }, []);

  const handleFileUpload = async (file: File) => {
    setUploading(true);
    setUploadError(null);
    const form = new FormData();
    form.append("file", file);
    try {
      const res = await fetch("/api/video/upload", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail ?? "Upload failed");
    } catch (e: any) {
      setUploadError(e.message);
    } finally {
      setUploading(false);
    }
  };

  const startProcessing = async () => {
    const res = await fetch("/api/video/start", { method: "POST" });
    if (!res.ok) {
      const d = await res.json();
      setUploadError(d.detail);
    }
  };

  const stopProcessing = async () => {
    await fetch("/api/video/stop", { method: "POST" });
  };

  const isProcessing = videoStatus?.mode === "processing";
  const hasUpload = videoStatus?.filename && videoStatus?.mode !== "simulation";

  const metricPills = [
    { icon: Users, label: "PERSONS", value: stats?.person_count ?? 0, color: "#3b82f6" },
    { icon: Package, label: "OBJECTS", value: stats?.object_count ?? 0, color: "#f59e0b" },
    { icon: AlertTriangle, label: "ANOMALIES", value: anomalies.length, color: anomalies.length > 0 ? "#ef4444" : "#10b981" },
    { icon: Activity, label: "ACTIVE TRACKS", value: tracks.length, color: "#a855f7" },
  ];

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 22 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "#f1f5f9", letterSpacing: -0.5, marginBottom: 4 }}>
            Live Surveillance Dashboard
          </h1>
          <p style={{ color: "#475569", fontSize: 13 }}>
            {sourceMode === "video"
              ? "Real detection · YOLOv4-tiny + SORT Tracking · VIDEO MODE"
              : "Simulation mode · Anomaly detection engine running"}
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {/* Sound toggle */}
          <button
            onClick={() => setSoundEnabled(v => !v)}
            title={soundEnabled ? "Mute alerts" : "Unmute alerts"}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "8px 14px", borderRadius: 8,
              border: "1px solid rgba(255,255,255,0.1)",
              background: "rgba(255,255,255,0.04)",
              color: soundEnabled ? "#10b981" : "#475569",
              cursor: "pointer", fontSize: 12, fontWeight: 600,
            }}
          >
            {soundEnabled ? <Volume2 size={14} /> : <VolumeX size={14} />}
            {soundEnabled ? "Sound ON" : "Sound OFF"}
          </button>

          {/* Webcam toggle */}
          {cameraError && <span style={{ fontSize: 11, color: "#ef4444", maxWidth: 160 }}>{cameraError}</span>}
          <button
            onClick={cameraMode === "simulation" ? enableCamera : disableCamera}
            style={{
              display: "flex", alignItems: "center", gap: 8, padding: "8px 16px", borderRadius: 8,
              border: "1px solid", cursor: "pointer", fontSize: 12, fontWeight: 600, transition: "all 0.2s",
              borderColor: cameraMode === "webcam" ? "#10b981" : "rgba(255,255,255,0.12)",
              background: cameraMode === "webcam" ? "rgba(16,185,129,0.12)" : "rgba(255,255,255,0.04)",
              color: cameraMode === "webcam" ? "#10b981" : "#94a3b8",
            }}
          >
            {cameraMode === "webcam" ? <><CameraOff size={14} /> Disable Camera</> : <><Camera size={14} /> Enable Camera</>}
          </button>

          {/* Video upload toggle */}
          <button
            onClick={() => setShowVideoPanel(v => !v)}
            style={{
              display: "flex", alignItems: "center", gap: 8, padding: "8px 16px", borderRadius: 8,
              border: "1px solid",
              borderColor: showVideoPanel || isProcessing ? "#a855f7" : "rgba(255,255,255,0.12)",
              background: showVideoPanel || isProcessing ? "rgba(168,85,247,0.12)" : "rgba(255,255,255,0.04)",
              color: showVideoPanel || isProcessing ? "#a855f7" : "#94a3b8",
              cursor: "pointer", fontSize: 12, fontWeight: 600,
            }}
          >
            <Video size={14} />
            {isProcessing ? "Video Running" : "Upload Video"}
          </button>

          <div style={{
            padding: "8px 14px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.08)",
            background: "rgba(255,255,255,0.03)", display: "flex", alignItems: "center",
            gap: 6, fontSize: 11, color: "#64748b", fontWeight: 600,
          }}>
            {sourceMode === "video" ? <Video size={13} color="#a855f7" /> : cameraMode === "webcam" ? <Camera size={13} color="#10b981" /> : <Monitor size={13} />}
            {sourceMode === "video" ? "VIDEO DETECT" : cameraMode === "webcam" ? "WEBCAM ACTIVE" : "SIMULATION MODE"}
          </div>
        </div>
      </div>

      {/* Video Upload Panel */}
      {showVideoPanel && (
        <div style={{
          background: "rgba(168,85,247,0.05)", border: "1px solid rgba(168,85,247,0.2)",
          borderRadius: 14, padding: 20, marginBottom: 20,
        }}>
          <div style={{ fontSize: 9, color: "#a855f7", letterSpacing: 2, fontWeight: 700, marginBottom: 14 }}>
            YOLOv4-TINY REAL DETECTION · OPENCV DNN + SORT TRACKING
          </div>

          {/* Model status */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16, fontSize: 11 }}>
            {videoStatus?.model_ready ? (
              <><CheckCircle size={13} color="#10b981" /><span style={{ color: "#10b981" }}>YOLOv4-tiny model ready (~23 MB)</span></>
            ) : videoStatus?.model_error ? (
              <><span style={{ color: "#ef4444" }}>Model error: {videoStatus.model_error}</span></>
            ) : (
              <><Loader size={13} color="#f59e0b" style={{ animation: "spin 1s linear infinite" }} />
              <span style={{ color: "#f59e0b" }}>Downloading YOLOv4-tiny model (~23 MB)…</span></>
            )}
          </div>

          {/* Drop zone */}
          {!isProcessing && (
            <div
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={e => {
                e.preventDefault(); setDragOver(false);
                const file = e.dataTransfer.files[0];
                if (file) handleFileUpload(file);
              }}
              onClick={() => fileInputRef.current?.click()}
              style={{
                border: `2px dashed ${dragOver ? "#a855f7" : "rgba(168,85,247,0.3)"}`,
                borderRadius: 10, padding: "24px 20px", textAlign: "center",
                cursor: "pointer", transition: "border-color 0.2s",
                background: dragOver ? "rgba(168,85,247,0.08)" : "transparent",
                marginBottom: 12,
              }}
            >
              <Upload size={24} color="#a855f7" style={{ margin: "0 auto 8px" }} />
              <div style={{ color: "#94a3b8", fontSize: 13 }}>
                {uploading ? "Uploading…" : videoStatus?.filename && hasUpload
                  ? <><span style={{ color: "#a855f7", fontWeight: 600 }}>{videoStatus.filename}</span> · ready</>
                  : "Drop video here or click to browse"}
              </div>
              <div style={{ fontSize: 11, color: "#334155", marginTop: 4 }}>
                MP4, AVI, MOV, MKV — max 200 MB
              </div>
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="video/*"
            style={{ display: "none" }}
            onChange={e => {
              const file = e.target.files?.[0];
              if (file) handleFileUpload(file);
              e.target.value = "";
            }}
          />

          {uploadError && <div style={{ color: "#ef4444", fontSize: 12, marginBottom: 10 }}>{uploadError}</div>}

          {/* Progress bar */}
          {isProcessing && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#64748b", marginBottom: 6 }}>
                <span>Processing: {videoStatus?.filename}</span>
                <span>{videoStatus?.progress}% · frame {videoStatus?.current_frame}/{videoStatus?.total_frames}</span>
              </div>
              <div style={{ height: 6, background: "rgba(255,255,255,0.06)", borderRadius: 3 }}>
                <div style={{
                  height: "100%", borderRadius: 3,
                  width: `${videoStatus?.progress ?? 0}%`,
                  background: "linear-gradient(90deg, #7c3aed, #a855f7)",
                  transition: "width 0.5s",
                }} />
              </div>
            </div>
          )}

          {videoStatus?.error && (
            <div style={{ color: "#ef4444", fontSize: 12, marginBottom: 10 }}>Error: {videoStatus.error}</div>
          )}

          {/* Start / Stop buttons */}
          <div style={{ display: "flex", gap: 10 }}>
            {!isProcessing && hasUpload && (
              <button
                onClick={startProcessing}
                disabled={!videoStatus?.model_ready}
                style={{
                  display: "flex", alignItems: "center", gap: 8, padding: "8px 18px",
                  borderRadius: 8, border: "none", cursor: videoStatus?.model_ready ? "pointer" : "not-allowed",
                  background: videoStatus?.model_ready ? "linear-gradient(135deg,#7c3aed,#a855f7)" : "#1e1b4b",
                  color: "#fff", fontWeight: 700, fontSize: 13,
                }}
              >
                <Video size={14} /> Start Real Detection
              </button>
            )}
            {isProcessing && (
              <button
                onClick={stopProcessing}
                style={{
                  display: "flex", alignItems: "center", gap: 8, padding: "8px 18px",
                  borderRadius: 8, border: "none", cursor: "pointer",
                  background: "rgba(239,68,68,0.15)", color: "#ef4444",
                  fontWeight: 700, fontSize: 13, outline: "1px solid rgba(239,68,68,0.3)",
                }}
              >
                <StopCircle size={14} /> Stop & Return to Simulation
              </button>
            )}
          </div>
        </div>
      )}

      {/* Main grid */}
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
              cameraMode={cameraMode}
              videoRef={videoRef}
              sourceMode={sourceMode}
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
      `}</style>
    </div>
  );
}
