import { Anomaly } from "../hooks/useSimulation";

const ANOMALY_META: Record<string, { color: string; icon: string; label: string }> = {
  running: { color: "#a855f7", icon: "⚡", label: "RUNNING DETECTED" },
  unattended_object: { color: "#ef4444", icon: "🚨", label: "UNATTENDED OBJECT" },
  overcrowding: { color: "#f97316", icon: "⚠", label: "OVERCROWDING" },
};

interface Props {
  anomalies: Anomaly[];
}

export default function AlertsFeed({ anomalies }: Props) {
  return (
    <div
      style={{
        background: "#1e293b",
        borderRadius: 12,
        padding: "16px",
        flex: 1,
      }}
    >
      <div
        style={{
          fontSize: 10,
          color: "#64748b",
          letterSpacing: 1.5,
          fontWeight: 700,
          marginBottom: 14,
          borderBottom: "1px solid #334155",
          paddingBottom: 10,
        }}
      >
        ACTIVE INCIDENTS
      </div>

      {anomalies.length === 0 ? (
        <div style={{ color: "#475569", fontSize: 13, textAlign: "center", padding: "20px 0" }}>
          <div style={{ fontSize: 28, marginBottom: 8 }}>✅</div>
          No threats detected
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {anomalies.map((a, i) => {
            const meta = ANOMALY_META[a.type] ?? { color: "#fff", icon: "●", label: a.type.toUpperCase() };
            return (
              <div
                key={i}
                className="slide-in"
                style={{
                  background: "rgba(255,255,255,0.04)",
                  borderRadius: 8,
                  padding: "10px 12px",
                  borderLeft: `4px solid ${meta.color}`,
                }}
              >
                <div style={{ color: meta.color, fontWeight: 700, fontSize: 12, marginBottom: 4 }}>
                  {meta.icon} {meta.label}
                </div>
                {a.track_id !== undefined && (
                  <div style={{ color: "#64748b", fontSize: 11 }}>Track ID: #{a.track_id}</div>
                )}
                {a.count !== undefined && (
                  <div style={{ color: "#64748b", fontSize: 11 }}>{a.count} people in zone</div>
                )}
                {a.duration !== undefined && (
                  <div style={{ color: "#64748b", fontSize: 11 }}>Duration: {a.duration}s</div>
                )}
                {a.position && (
                  <div style={{ color: "#475569", fontSize: 10, marginTop: 2 }}>
                    pos: ({Math.round(a.position[0])}, {Math.round(a.position[1])})
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
