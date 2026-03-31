import { useRef, useEffect } from "react";
import { FrameData } from "../hooks/useSimulation";
import SimulationCanvas from "../components/SimulationCanvas";
import StatsCards from "../components/StatsCards";
import AlertsFeed from "../components/AlertsFeed";

interface Props {
  frame: FrameData | null;
  connected: boolean;
}

export default function Dashboard({ frame, connected }: Props) {
  const rafRef = useRef<number>(0);
  const canvasContainerRef = useRef<HTMLDivElement>(null);

  const tracks = frame?.tracks ?? [];
  const anomalies = frame?.anomalies ?? [];
  const stats = frame?.stats ?? null;

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "#f1f5f9", letterSpacing: 1 }}>
          Live Surveillance Dashboard
        </h1>
        <p style={{ color: "#475569", fontSize: 13, marginTop: 4 }}>
          Real-time anomaly detection · YOLOv8 + SORT Tracking Simulation
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: 20, alignItems: "start" }}>
        <div>
          <div
            ref={canvasContainerRef}
            style={{
              background: "#050d1a",
              borderRadius: 12,
              border: "2px solid #1e293b",
              overflow: "hidden",
              boxShadow: "0 10px 40px rgba(0,0,0,0.6)",
              position: "relative",
            }}
          >
            {!connected && (
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  background: "rgba(15,23,42,0.85)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexDirection: "column",
                  gap: 10,
                  zIndex: 10,
                }}
              >
                <div style={{ fontSize: 32 }}>📡</div>
                <div style={{ color: "#64748b", fontSize: 14 }}>Connecting to detection engine…</div>
              </div>
            )}
            <SimulationCanvas tracks={tracks} anomalies={anomalies} />
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, 1fr)",
              gap: 12,
              marginTop: 14,
            }}
          >
            {[
              { label: "Persons", value: stats?.person_count ?? 0, color: "#3b82f6" },
              { label: "Objects", value: stats?.object_count ?? 0, color: "#eab308" },
              { label: "Anomalies", value: anomalies.length, color: anomalies.length > 0 ? "#ef4444" : "#22c55e" },
              { label: "Active Tracks", value: tracks.length, color: "#a855f7" },
            ].map((m) => (
              <div
                key={m.label}
                style={{
                  background: "#1e293b",
                  borderRadius: 8,
                  padding: "10px 14px",
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                }}
              >
                <span style={{ fontSize: 22, fontWeight: 800, color: m.color }}>{m.value}</span>
                <span style={{ fontSize: 11, color: "#64748b", fontWeight: 600 }}>{m.label.toUpperCase()}</span>
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <StatsCards stats={stats} anomalyCount={anomalies.length} />
          <AlertsFeed anomalies={anomalies} />
        </div>
      </div>
    </div>
  );
}
