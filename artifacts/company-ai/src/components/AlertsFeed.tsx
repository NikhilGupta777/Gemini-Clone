import { Anomaly } from "../hooks/useSimulation";
import { Zap, AlertCircle, Users } from "lucide-react";

const ANOMALY_META: Record<string, {
  color: string;
  bg: string;
  Icon: typeof Zap;
  label: string;
  severity: string;
}> = {
  running:          { color: "#a855f7", bg: "rgba(168,85,247,0.08)",  Icon: Zap,         label: "Running Detected",   severity: "CRITICAL" },
  unattended_object:{ color: "#ef4444", bg: "rgba(239,68,68,0.08)",   Icon: AlertCircle, label: "Unattended Object",  severity: "HIGH"     },
  overcrowding:     { color: "#f97316", bg: "rgba(249,115,22,0.08)",  Icon: Users,       label: "Overcrowding",       severity: "MEDIUM"   },
};

interface Props {
  anomalies: Anomaly[];
}

export default function AlertsFeed({ anomalies }: Props) {
  return (
    <div style={{
      background: "rgba(255,255,255,0.025)",
      border: "1px solid rgba(255,255,255,0.07)",
      borderRadius: 14,
      padding: "18px",
      flex: 1,
    }}>
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 14,
        paddingBottom: 12,
        borderBottom: "1px solid rgba(255,255,255,0.06)",
      }}>
        <div style={{ fontSize: 9, color: "#475569", letterSpacing: 2, fontWeight: 700 }}>
          ACTIVE INCIDENTS
        </div>
        {anomalies.length > 0 && (
          <div style={{
            background: "rgba(239,68,68,0.15)",
            color: "#ef4444",
            fontSize: 9,
            fontWeight: 800,
            padding: "2px 8px",
            borderRadius: 20,
            letterSpacing: 1,
          }}>
            {anomalies.length} ACTIVE
          </div>
        )}
      </div>

      {anomalies.length === 0 ? (
        <div style={{
          textAlign: "center",
          padding: "24px 0",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 10,
        }}>
          <div style={{
            width: 40, height: 40, borderRadius: "50%",
            background: "rgba(16,185,129,0.1)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <span style={{ fontSize: 20 }}>✓</span>
          </div>
          <div style={{ color: "#334155", fontSize: 12, fontWeight: 600 }}>No active threats</div>
          <div style={{ color: "#1e3a5f", fontSize: 11 }}>All zones nominal</div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {anomalies.map((a, i) => {
            const meta = ANOMALY_META[a.type] ?? {
              color: "#94a3b8", bg: "rgba(148,163,184,0.08)",
              Icon: AlertCircle, label: a.type.toUpperCase(), severity: "INFO",
            };
            const { Icon } = meta;
            return (
              <div
                key={i}
                className="slide-in"
                style={{
                  background: meta.bg,
                  border: `1px solid ${meta.color}30`,
                  borderRadius: 10,
                  padding: "11px 13px",
                  position: "relative",
                  overflow: "hidden",
                }}
              >
                {/* Glow strip */}
                <div style={{
                  position: "absolute", left: 0, top: 0, bottom: 0, width: 3,
                  background: `linear-gradient(180deg, ${meta.color}, ${meta.color}88)`,
                  borderRadius: "3px 0 0 3px",
                }} />

                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                  <Icon size={13} color={meta.color} />
                  <span style={{ color: meta.color, fontWeight: 700, fontSize: 12 }}>
                    {meta.label}
                  </span>
                  <span style={{
                    marginLeft: "auto",
                    background: meta.color + "22",
                    color: meta.color,
                    fontSize: 8,
                    fontWeight: 800,
                    padding: "1px 6px",
                    borderRadius: 10,
                    letterSpacing: 1,
                  }}>
                    {meta.severity}
                  </span>
                </div>

                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, paddingLeft: 2 }}>
                  {a.track_id !== undefined && (
                    <span style={{ fontSize: 10, color: "#64748b" }}>Track #{a.track_id}</span>
                  )}
                  {a.count !== undefined && (
                    <span style={{ fontSize: 10, color: "#64748b" }}>{a.count} people</span>
                  )}
                  {a.duration !== undefined && (
                    <span style={{ fontSize: 10, color: "#64748b" }}>{a.duration}s elapsed</span>
                  )}
                  {a.position && (
                    <span style={{ fontSize: 10, color: "#1e3a5f", fontFamily: "monospace" }}>
                      ({Math.round(a.position[0])}, {Math.round(a.position[1])})
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
