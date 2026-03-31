import { useEffect, useState } from "react";

interface AlertRecord {
  id: number;
  anomaly: {
    type: string;
    track_id?: number;
    count?: number;
    duration?: number;
    position: [number, number] | null;
  };
  timestamp: number;
  iso: string;
}

const TYPE_META: Record<string, { color: string; icon: string; label: string }> = {
  running: { color: "#a855f7", icon: "⚡", label: "Running Detected" },
  unattended_object: { color: "#ef4444", icon: "🚨", label: "Unattended Object" },
  overcrowding: { color: "#f97316", icon: "⚠", label: "Overcrowding" },
};

export default function AlertHistory() {
  const [alerts, setAlerts] = useState<AlertRecord[]>([]);
  const [filter, setFilter] = useState<string>("all");
  const [loading, setLoading] = useState(true);

  const fetchHistory = async () => {
    try {
      const res = await fetch("/api/alerts/history?limit=200");
      const data = await res.json();
      setAlerts(data.alerts || []);
    } catch {}
    setLoading(false);
  };

  useEffect(() => {
    fetchHistory();
    const interval = setInterval(fetchHistory, 2000);
    return () => clearInterval(interval);
  }, []);

  const filtered = filter === "all" ? alerts : alerts.filter((a) => a.anomaly.type === filter);

  const counts = alerts.reduce<Record<string, number>>((acc, a) => {
    acc[a.anomaly.type] = (acc[a.anomaly.type] || 0) + 1;
    return acc;
  }, {});

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "#f1f5f9", letterSpacing: 1 }}>
          Alert History
        </h1>
        <p style={{ color: "#475569", fontSize: 13, marginTop: 4 }}>
          Full incident log with timestamps
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14, marginBottom: 20 }}>
        {Object.entries(TYPE_META).map(([type, meta]) => (
          <div
            key={type}
            style={{
              background: "#1e293b",
              borderRadius: 10,
              padding: "14px 18px",
              borderLeft: `4px solid ${meta.color}`,
            }}
          >
            <div style={{ fontSize: 11, color: "#64748b", letterSpacing: 1, marginBottom: 4 }}>
              {meta.label.toUpperCase()}
            </div>
            <div style={{ fontSize: 32, fontWeight: 800, color: meta.color }}>{counts[type] ?? 0}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {["all", "running", "unattended_object", "overcrowding"].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{
              padding: "6px 14px",
              borderRadius: 6,
              border: "1px solid",
              borderColor: filter === f ? "#3b82f6" : "#334155",
              background: filter === f ? "rgba(59,130,246,0.15)" : "transparent",
              color: filter === f ? "#60a5fa" : "#64748b",
              cursor: "pointer",
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            {f === "all" ? "All" : TYPE_META[f]?.label ?? f}
          </button>
        ))}
        <button
          onClick={fetchHistory}
          style={{
            marginLeft: "auto",
            padding: "6px 14px",
            borderRadius: 6,
            border: "1px solid #334155",
            background: "transparent",
            color: "#64748b",
            cursor: "pointer",
            fontSize: 12,
          }}
        >
          ↻ Refresh
        </button>
      </div>

      <div style={{ background: "#1e293b", borderRadius: 12, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ background: "#0f172a", color: "#64748b", fontSize: 11, letterSpacing: 1 }}>
              {["TIME", "TYPE", "DETAILS", "POSITION"].map((h) => (
                <th key={h} style={{ padding: "10px 16px", textAlign: "left", fontWeight: 700 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={4} style={{ padding: 24, textAlign: "center", color: "#475569" }}>
                  Loading…
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={4} style={{ padding: 24, textAlign: "center", color: "#475569" }}>
                  No alerts recorded yet
                </td>
              </tr>
            ) : (
              filtered.map((record, i) => {
                const meta = TYPE_META[record.anomaly.type] ?? { color: "#fff", icon: "●", label: record.anomaly.type };
                return (
                  <tr
                    key={record.id}
                    style={{ borderTop: i > 0 ? "1px solid #334155" : "none" }}
                  >
                    <td style={{ padding: "10px 16px", color: "#94a3b8", whiteSpace: "nowrap" }}>
                      {new Date(record.timestamp * 1000).toLocaleTimeString()}
                    </td>
                    <td style={{ padding: "10px 16px" }}>
                      <span
                        style={{
                          background: meta.color + "22",
                          color: meta.color,
                          padding: "3px 10px",
                          borderRadius: 20,
                          fontSize: 11,
                          fontWeight: 700,
                        }}
                      >
                        {meta.icon} {meta.label}
                      </span>
                    </td>
                    <td style={{ padding: "10px 16px", color: "#94a3b8", fontSize: 12 }}>
                      {record.anomaly.track_id !== undefined && `Track #${record.anomaly.track_id}`}
                      {record.anomaly.count !== undefined && `${record.anomaly.count} people`}
                      {record.anomaly.duration !== undefined && ` · ${record.anomaly.duration}s`}
                    </td>
                    <td style={{ padding: "10px 16px", color: "#475569", fontSize: 11, fontFamily: "monospace" }}>
                      {record.anomaly.position
                        ? `(${Math.round(record.anomaly.position[0])}, ${Math.round(record.anomaly.position[1])})`
                        : "—"}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
