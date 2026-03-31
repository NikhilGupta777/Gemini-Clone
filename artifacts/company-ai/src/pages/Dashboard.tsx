import { useRef, useState, useCallback } from "react";
import { FrameData } from "../hooks/useSimulation";
import SimulationCanvas from "../components/SimulationCanvas";
import StatsCards from "../components/StatsCards";
import AlertsFeed from "../components/AlertsFeed";
import { Camera, CameraOff, Monitor, Cpu, Users, Package, AlertTriangle, Activity } from "lucide-react";

interface Props {
  frame: FrameData | null;
  connected: boolean;
}

type CameraMode = "simulation" | "webcam";

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
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const tracks = frame?.tracks ?? [];
  const anomalies = frame?.anomalies ?? [];
  const stats = frame?.stats ?? null;

  const enableCamera = useCallback(async () => {
    setCameraError(null);
    try {
      // Try to stop existing stream
      streamRef.current?.getTracks().forEach(t => t.stop());

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "environment" },
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
      setCameraMode("simulation");
    }
  }, []);

  const disableCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraMode("simulation");
    setCameraError(null);
  }, []);

  const metricPills = [
    { icon: Users,          label: "PERSONS",       value: stats?.person_count ?? 0, color: "#3b82f6"  },
    { icon: Package,        label: "OBJECTS",        value: stats?.object_count ?? 0,  color: "#f59e0b"  },
    { icon: AlertTriangle,  label: "ANOMALIES",      value: anomalies.length,           color: anomalies.length > 0 ? "#ef4444" : "#10b981" },
    { icon: Activity,       label: "ACTIVE TRACKS",  value: tracks.length,              color: "#a855f7"  },
  ];

  return (
    <div>
      {/* Page heading */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 22 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "#f1f5f9", letterSpacing: -0.5, marginBottom: 4 }}>
            Live Surveillance Dashboard
          </h1>
          <p style={{ color: "#475569", fontSize: 13 }}>
            Real-time anomaly detection · YOLOv8 + SORT Tracking Simulation
          </p>
        </div>

        {/* Camera source switcher */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {cameraError && (
            <span style={{ fontSize: 11, color: "#ef4444", maxWidth: 180 }}>{cameraError}</span>
          )}
          <button
            onClick={cameraMode === "simulation" ? enableCamera : disableCamera}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "8px 16px",
              borderRadius: 8,
              border: "1px solid",
              borderColor: cameraMode === "webcam" ? "#10b981" : "rgba(255,255,255,0.12)",
              background: cameraMode === "webcam"
                ? "rgba(16,185,129,0.12)"
                : "rgba(255,255,255,0.04)",
              color: cameraMode === "webcam" ? "#10b981" : "#94a3b8",
              cursor: "pointer",
              fontSize: 12,
              fontWeight: 600,
              transition: "all 0.2s",
            }}
          >
            {cameraMode === "webcam"
              ? <><CameraOff size={14} /> Disable Camera</>
              : <><Camera size={14} /> Enable Camera</>}
          </button>

          <div style={{
            padding: "8px 14px",
            borderRadius: 8,
            border: "1px solid rgba(255,255,255,0.08)",
            background: "rgba(255,255,255,0.03)",
            display: "flex",
            alignItems: "center",
            gap: 6,
            fontSize: 11,
            color: "#64748b",
            fontWeight: 600,
          }}>
            {cameraMode === "webcam" ? <Camera size={13} color="#10b981" /> : <Monitor size={13} />}
            {cameraMode === "webcam" ? "WEBCAM ACTIVE" : "SIMULATION MODE"}
          </div>
        </div>
      </div>

      {/* Main grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 310px", gap: 20, alignItems: "start" }}>

        {/* Left: Canvas + pills */}
        <div>
          {/* Canvas container */}
          <div style={{
            borderRadius: 14,
            border: "1px solid rgba(255,255,255,0.08)",
            overflow: "hidden",
            background: "#060a12",
            position: "relative",
            boxShadow: "0 20px 60px rgba(0,0,0,0.6), 0 0 0 1px rgba(59,130,246,0.1)",
          }}>
            {/* Connecting overlay */}
            {!connected && (
              <div style={{
                position: "absolute", inset: 0,
                background: "rgba(6,10,18,0.88)",
                display: "flex", alignItems: "center", justifyContent: "center",
                flexDirection: "column", gap: 14, zIndex: 10,
                backdropFilter: "blur(4px)",
              }}>
                <Cpu size={36} color="#1e3a5f" />
                <div style={{ color: "#334155", fontSize: 14, fontWeight: 600 }}>Connecting to detection engine…</div>
                <div style={{ display: "flex", gap: 6 }}>
                  {[0,1,2].map(i => (
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

        {/* Right: Stat cards + active incidents */}
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
      `}</style>
    </div>
  );
}
