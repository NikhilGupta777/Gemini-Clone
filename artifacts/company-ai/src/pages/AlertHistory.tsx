import { useEffect, useState, useMemo } from "react";
import { Zap, AlertCircle, Users, RefreshCw, Filter, Download, BarChart2 } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, Legend,
} from "recharts";

interface AlertRecord {
  id: number;
  anomaly: {
    type: string;
    track_id?: number;
    count?: number;
    duration?: number;
    avg_speed?: number;
    position: [number, number] | null;
  };
  timestamp: number;
  iso: string;
  source?: string;
}

const TYPE_META: Record<string, { color: string; Icon: typeof Zap; label: string; severity: string }> = {
  running:           { color: "#a855f7", Icon: Zap,         label: "Running",          severity: "CRITICAL" },
  unattended_object: { color: "#ef4444", Icon: AlertCircle, label: "Unattended Object", severity: "HIGH"     },
  overcrowding:      { color: "#f97316", Icon: Users,       label: "Overcrowding",      severity: "MEDIUM"   },
};

function exportCSV(alerts: AlertRecord[]) {
  const headers = ["Time", "ISO", "Type", "Severity", "Track ID", "Count", "Speed (px/f)", "Duration (s)", "Position X", "Position Y", "Source"];
  const rows = alerts.map(r => {
    const meta = TYPE_META[r.anomaly.type];
    return [
      new Date(r.timestamp * 1000).toLocaleTimeString("en-IN"),
      r.iso,
      meta?.label ?? r.anomaly.type,
      meta?.severity ?? "INFO",
      r.anomaly.track_id ?? "",
      r.anomaly.count ?? "",
      r.anomaly.avg_speed ?? "",
      r.anomaly.duration ?? "",
      r.anomaly.position ? Math.round(r.anomaly.position[0]) : "",
      r.anomaly.position ? Math.round(r.anomaly.position[1]) : "",
      (r.source ?? "live").toUpperCase(),
    ].join(",");
  });
  const csv = [headers.join(","), ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `crowdlens_alerts_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

interface ChartBucket {
  time: string;
  running: number;
  unattended_object: number;
  overcrowding: number;
}

function buildChartData(alerts: AlertRecord[]): ChartBucket[] {
  if (alerts.length === 0) return [];
  const buckets: Record<string, ChartBucket> = {};
  const now = Date.now() / 1000;
  const range = 600; // last 10 minutes in 1-min buckets

  for (let i = 0; i < 10; i++) {
    const t = Math.floor((now - (9 - i) * 60) / 60) * 60;
    const label = new Date(t * 1000).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
    buckets[label] = { time: label, running: 0, unattended_object: 0, overcrowding: 0 };
  }

  for (const r of alerts) {
    if (now - r.timestamp > range) continue;
    const t = Math.floor(r.timestamp / 60) * 60;
    const label = new Date(t * 1000).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
    const bucket = buckets[label];
    if (bucket) {
      const type = r.anomaly.type as keyof Omit<ChartBucket, "time">;
      if (type === "running" || type === "unattended_object" || type === "overcrowding") {
        bucket[type] = (bucket[type] ?? 0) + 1;
      }
    }
  }

  return Object.values(buckets);
}

export default function AlertHistory() {
  const [alerts, setAlerts] = useState<AlertRecord[]>([]);
  const [filter, setFilter] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showChart, setShowChart] = useState(true);

  const fetchHistory = async (showRefreshing = false) => {
    if (showRefreshing) setRefreshing(true);
    try {
      const res = await fetch("/api/alerts/history?limit=200");
      const data = await res.json();
      setAlerts(data.alerts || []);
    } catch {}
    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => {
    fetchHistory();
    const interval = setInterval(() => fetchHistory(), 3000);
    return () => clearInterval(interval);
  }, []);

  const filtered = filter === "all" ? alerts : alerts.filter(a => a.anomaly.type === filter);
  const counts = alerts.reduce<Record<string, number>>((acc, a) => {
    acc[a.anomaly.type] = (acc[a.anomaly.type] || 0) + 1;
    return acc;
  }, {});

  const summaryCards = Object.entries(TYPE_META).map(([type, meta]) => ({
    type, ...meta, count: counts[type] ?? 0,
  }));

  const chartData = useMemo(() => buildChartData(alerts), [alerts]);

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "#f1f5f9", letterSpacing: -0.5, marginBottom: 4 }}>
            Alert History
          </h1>
          <p style={{ color: "#475569", fontSize: 13 }}>
            Full incident log · {alerts.length} total events recorded
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={() => setShowChart(v => !v)}
            style={{
              display: "flex", alignItems: "center", gap: 8, padding: "8px 16px", borderRadius: 8,
              border: "1px solid rgba(255,255,255,0.1)", background: showChart ? "rgba(59,130,246,0.1)" : "rgba(255,255,255,0.04)",
              color: showChart ? "#3b82f6" : "#64748b", cursor: "pointer", fontSize: 12,
            }}
          >
            <BarChart2 size={13} /> {showChart ? "Hide Chart" : "Show Chart"}
          </button>
          <button
            onClick={() => exportCSV(filtered)}
            style={{
              display: "flex", alignItems: "center", gap: 8, padding: "8px 16px", borderRadius: 8,
              border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.04)",
              color: "#64748b", cursor: "pointer", fontSize: 12,
            }}
          >
            <Download size={13} /> Export CSV
          </button>
          <button
            onClick={() => fetchHistory(true)}
            style={{
              display: "flex", alignItems: "center", gap: 8, padding: "8px 16px", borderRadius: 8,
              border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.04)",
              color: "#64748b", cursor: "pointer", fontSize: 12,
            }}
          >
            <RefreshCw size={13} style={{ animation: refreshing ? "spin 0.8s linear infinite" : "none" }} />
            Refresh
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14, marginBottom: 24 }}>
        {summaryCards.map(({ type, color, Icon, label, count, severity }) => (
          <div
            key={type}
            onClick={() => setFilter(filter === type ? "all" : type)}
            style={{
              background: "rgba(255,255,255,0.025)", border: `1px solid rgba(255,255,255,0.07)`,
              borderRadius: 14, padding: "18px 20px", borderLeft: `3px solid ${color}`,
              cursor: "pointer",
              boxShadow: filter === type ? `0 0 20px ${color}22` : "none",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <div style={{ fontSize: 9, color: "#475569", letterSpacing: 2, fontWeight: 700 }}>
                {label.toUpperCase()}
              </div>
              <div style={{ background: color + "18", borderRadius: 8, padding: 5 }}>
                <Icon size={13} color={color} />
              </div>
            </div>
            <div style={{ fontSize: 40, fontWeight: 800, color, lineHeight: 1, textShadow: `0 0 20px ${color}55` }}>
              {count}
            </div>
            <div style={{ fontSize: 10, color: "#334155", marginTop: 8, fontWeight: 600, letterSpacing: 1 }}>
              {severity}
            </div>
          </div>
        ))}
      </div>

      {/* Trend Chart */}
      {showChart && (
        <div style={{
          background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.07)",
          borderRadius: 14, padding: "20px 24px", marginBottom: 20,
        }}>
          <div style={{ fontSize: 9, color: "#475569", letterSpacing: 2, fontWeight: 700, marginBottom: 16 }}>
            ALERT TREND · LAST 10 MINUTES
          </div>
          {chartData.every(d => d.running === 0 && d.unattended_object === 0 && d.overcrowding === 0) ? (
            <div style={{ textAlign: "center", padding: "20px 0", color: "#334155", fontSize: 13 }}>
              No recent alert data — alerts will appear here as they occur
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={chartData} barCategoryGap="30%">
                <XAxis dataKey="time" tick={{ fill: "#334155", fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "#334155", fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ background: "#0d1525", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontSize: 12 }}
                  labelStyle={{ color: "#94a3b8" }}
                />
                <Legend wrapperStyle={{ fontSize: 11, color: "#64748b" }} />
                <Bar dataKey="running" name="Running" fill="#a855f7" radius={[3, 3, 0, 0]} />
                <Bar dataKey="unattended_object" name="Unattended Object" fill="#ef4444" radius={[3, 3, 0, 0]} />
                <Bar dataKey="overcrowding" name="Overcrowding" fill="#f97316" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      )}

      {/* Filters */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
        <Filter size={13} color="#475569" />
        {["all", "running", "unattended_object", "overcrowding"].map(f => {
          const meta = TYPE_META[f as keyof typeof TYPE_META];
          const active = filter === f;
          return (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={{
                padding: "6px 14px", borderRadius: 8, border: "1px solid", cursor: "pointer",
                fontSize: 12, fontWeight: 600, transition: "all 0.18s",
                borderColor: active ? (meta?.color ?? "#3b82f6") : "rgba(255,255,255,0.08)",
                background: active ? (meta?.color ?? "#3b82f6") + "18" : "rgba(255,255,255,0.03)",
                color: active ? (meta?.color ?? "#3b82f6") : "#64748b",
              }}
            >
              {f === "all" ? "All Events" : meta?.label ?? f}
            </button>
          );
        })}
        <div style={{ marginLeft: "auto", fontSize: 11, color: "#334155" }}>
          {filtered.length} events
        </div>
      </div>

      {/* Table */}
      <div style={{
        background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.07)",
        borderRadius: 14, overflow: "hidden",
      }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ background: "rgba(0,0,0,0.3)", color: "#334155", fontSize: 9, letterSpacing: 1.5, fontWeight: 700 }}>
              {["TIME", "TYPE", "SEVERITY", "DETAILS", "POSITION", "SOURCE"].map(h => (
                <th key={h} style={{ padding: "12px 18px", textAlign: "left" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} style={{ padding: 32, textAlign: "center", color: "#334155" }}>Loading…</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={6} style={{ padding: 32, textAlign: "center", color: "#334155" }}>No incidents recorded</td></tr>
            ) : (
              filtered.map((record) => {
                const meta = TYPE_META[record.anomaly.type] ?? { color: "#94a3b8", Icon: AlertCircle, label: record.anomaly.type, severity: "INFO" };
                const { Icon } = meta;
                return (
                  <tr
                    key={record.id}
                    style={{ borderTop: "1px solid rgba(255,255,255,0.04)", transition: "background 0.15s" }}
                    onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.02)")}
                    onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                  >
                    <td style={{ padding: "11px 18px", color: "#475569", whiteSpace: "nowrap", fontFamily: "monospace", fontSize: 12 }}>
                      {new Date(record.timestamp * 1000).toLocaleTimeString("en-IN")}
                    </td>
                    <td style={{ padding: "11px 18px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <Icon size={13} color={meta.color} />
                        <span style={{ background: meta.color + "18", color: meta.color, padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700 }}>
                          {meta.label}
                        </span>
                      </div>
                    </td>
                    <td style={{ padding: "11px 18px" }}>
                      <span style={{ background: "rgba(255,255,255,0.04)", color: "#64748b", padding: "2px 8px", borderRadius: 6, fontSize: 9, fontWeight: 800, letterSpacing: 1 }}>
                        {meta.severity}
                      </span>
                    </td>
                    <td style={{ padding: "11px 18px", color: "#64748b", fontSize: 12 }}>
                      {record.anomaly.track_id !== undefined && `Track #${record.anomaly.track_id}`}
                      {record.anomaly.count !== undefined && ` · ${record.anomaly.count} people`}
                      {record.anomaly.avg_speed !== undefined && (
                        <span style={{ color: "#a855f7", fontWeight: 600 }}> · {record.anomaly.avg_speed} px/f</span>
                      )}
                      {record.anomaly.duration !== undefined && ` · ${record.anomaly.duration}s`}
                    </td>
                    <td style={{ padding: "11px 18px", color: "#334155", fontSize: 11, fontFamily: "monospace" }}>
                      {record.anomaly.position
                        ? `(${Math.round(record.anomaly.position[0])}, ${Math.round(record.anomaly.position[1])})`
                        : <span style={{ color: "#1e3a5f" }}>—</span>}
                    </td>
                    <td style={{ padding: "11px 18px" }}>
                      <span style={{
                        fontSize: 9, fontWeight: 700, letterSpacing: 1, padding: "2px 8px", borderRadius: 6,
                        background:
                          record.source === "video" ? "rgba(168,85,247,0.1)"
                          : record.source === "stream" ? "rgba(245,158,11,0.1)"
                          : "rgba(16,185,129,0.1)",
                        color:
                          record.source === "video" ? "#a855f7"
                          : record.source === "stream" ? "#f59e0b"
                          : "#10b981",
                      }}>
                        {record.source === "video" ? "VIDEO"
                          : record.source === "stream" ? "STREAM"
                          : record.source === "webcam" ? "WEBCAM"
                          : (record.source ?? "LIVE").toUpperCase()}
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
