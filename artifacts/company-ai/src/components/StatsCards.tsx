import { SimStats } from "../hooks/useSimulation";

function Card({
  label, value, color, sub, pulse,
}: {
  label: string;
  value: string | number;
  color: string;
  sub?: string;
  pulse?: boolean;
}) {
  return (
    <div
      style={{
        background: "#1e293b",
        borderRadius: 12,
        padding: "18px 20px",
        borderLeft: `4px solid ${color}`,
        animation: pulse ? "pulse-ring 1.5s infinite" : "none",
        transition: "all 0.3s",
      }}
    >
      <div style={{ fontSize: 10, color: "#64748b", letterSpacing: 1.5, fontWeight: 700, marginBottom: 8 }}>
        {label}
      </div>
      <div style={{ fontSize: 36, fontWeight: 800, color, lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: "#475569", marginTop: 6 }}>{sub}</div>}
    </div>
  );
}

function formatUptime(s: number) {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

interface Props {
  stats: SimStats | null;
  anomalyCount: number;
}

export default function StatsCards({ stats, anomalyCount }: Props) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <Card
        label="LIVE OCCUPANCY"
        value={stats?.person_count ?? 0}
        color="#3b82f6"
        sub={`${stats?.object_count ?? 0} object(s) tracked`}
      />
      <Card
        label="THREAT LEVEL"
        value={anomalyCount}
        color={anomalyCount > 0 ? "#ef4444" : "#22c55e"}
        sub={anomalyCount > 0 ? "Incidents active" : "All clear"}
        pulse={anomalyCount > 0}
      />
      <Card
        label="TOTAL TRACKS"
        value={(stats?.person_count ?? 0) + (stats?.object_count ?? 0)}
        color="#a855f7"
        sub="Active in frame"
      />
      <Card
        label="SYSTEM UPTIME"
        value={formatUptime(stats?.uptime_seconds ?? 0)}
        color="#22c55e"
        sub="Detection engine running"
      />
    </div>
  );
}
