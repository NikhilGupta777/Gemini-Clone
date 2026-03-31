import { SimStats } from "../hooks/useSimulation";
import { Users, ShieldAlert, Activity, Clock } from "lucide-react";

function GlowNumber({ value, color }: { value: string | number; color: string }) {
  return (
    <div style={{
      fontSize: 42,
      fontWeight: 800,
      color,
      lineHeight: 1,
      fontVariantNumeric: "tabular-nums",
      textShadow: `0 0 20px ${color}55`,
      letterSpacing: -1,
    }}>
      {value}
    </div>
  );
}

function Card({
  label, icon: Icon, value, color, sub, pulse,
}: {
  label: string;
  icon: typeof Users;
  value: string | number;
  color: string;
  sub?: string;
  pulse?: boolean;
}) {
  return (
    <div style={{
      background: "rgba(255,255,255,0.025)",
      border: `1px solid rgba(255,255,255,0.07)`,
      borderRadius: 14,
      padding: "18px 20px",
      position: "relative",
      overflow: "hidden",
      transition: "border-color 0.3s",
      borderLeft: `3px solid ${color}`,
      boxShadow: pulse ? `0 0 24px ${color}22` : "none",
    }}>
      {/* Background tint */}
      <div style={{
        position: "absolute", top: 0, right: 0,
        width: 80, height: 80,
        background: `radial-gradient(circle at top right, ${color}18, transparent)`,
        pointerEvents: "none",
      }} />

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
        <div style={{ fontSize: 9, color: "#475569", letterSpacing: 2, fontWeight: 700 }}>
          {label}
        </div>
        <div style={{
          background: color + "18",
          borderRadius: 8,
          padding: "5px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}>
          <Icon size={14} color={color} />
        </div>
      </div>

      <GlowNumber value={value} color={color} />

      {sub && (
        <div style={{ fontSize: 11, color: "#334155", marginTop: 8, fontWeight: 500 }}>
          {sub}
        </div>
      )}

      {pulse && (
        <div style={{
          position: "absolute", bottom: 12, right: 16,
          width: 8, height: 8, borderRadius: "50%",
          background: color,
          boxShadow: `0 0 12px ${color}`,
          animation: "pulse-ring 1.4s infinite",
        }} />
      )}
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
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <Card
        label="LIVE OCCUPANCY"
        icon={Users}
        value={stats?.person_count ?? 0}
        color="#3b82f6"
        sub={`${stats?.object_count ?? 0} object(s) tracked`}
      />
      <Card
        label="THREAT LEVEL"
        icon={ShieldAlert}
        value={anomalyCount}
        color={anomalyCount > 0 ? "#ef4444" : "#10b981"}
        sub={anomalyCount > 0 ? `${anomalyCount} incident(s) active` : "All clear · No threats"}
        pulse={anomalyCount > 0}
      />
      <Card
        label="TOTAL TRACKS"
        icon={Activity}
        value={(stats?.person_count ?? 0) + (stats?.object_count ?? 0)}
        color="#a855f7"
        sub="Entities in frame"
      />
      <Card
        label="SYSTEM UPTIME"
        icon={Clock}
        value={formatUptime(stats?.uptime_seconds ?? 0)}
        color="#10b981"
        sub="Detection engine running"
      />
    </div>
  );
}
