import { ReactNode, useEffect, useState } from "react";
import { Link, useRoute } from "wouter";
import {
  LayoutDashboard, History, Settings, Wifi, WifiOff,
  Shield, ShieldAlert, ShieldX, Activity, Radio
} from "lucide-react";

interface Props {
  children: ReactNode;
  connected: boolean;
  threatLevel: "secure" | "warning" | "critical";
}

const navItems = [
  { path: "/", label: "Live Dashboard", icon: LayoutDashboard, exact: true },
  { path: "/history", label: "Alert History", icon: History, exact: false },
  { path: "/settings", label: "Settings", icon: Settings, exact: false },
];

function NavItem({ path, label, icon: Icon, exact }: (typeof navItems)[0]) {
  const [active] = useRoute(exact ? path : `${path}*`);
  return (
    <Link href={path}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "10px 14px",
          borderRadius: 10,
          cursor: "pointer",
          marginBottom: 2,
          fontSize: 13.5,
          fontWeight: active ? 600 : 400,
          background: active
            ? "linear-gradient(90deg, rgba(59,130,246,0.18) 0%, rgba(59,130,246,0.06) 100%)"
            : "transparent",
          color: active ? "#60a5fa" : "#64748b",
          borderLeft: `3px solid ${active ? "#3b82f6" : "transparent"}`,
          transition: "all 0.18s ease",
          position: "relative",
          overflow: "hidden",
        }}
        onMouseEnter={e => {
          if (!active) (e.currentTarget as HTMLDivElement).style.color = "#94a3b8";
        }}
        onMouseLeave={e => {
          if (!active) (e.currentTarget as HTMLDivElement).style.color = "#64748b";
        }}
      >
        {active && (
          <div style={{
            position: "absolute", left: 0, top: 0, bottom: 0, width: 3,
            background: "linear-gradient(180deg, #3b82f6, #6366f1)",
            borderRadius: "0 2px 2px 0",
          }} />
        )}
        <Icon size={16} style={{ flexShrink: 0 }} />
        {label}
      </div>
    </Link>
  );
}

function Clock() {
  const [time, setTime] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <span style={{ fontVariantNumeric: "tabular-nums" }}>
      {time.toLocaleString("en-IN", {
        weekday: "short", month: "short", day: "numeric",
        hour: "2-digit", minute: "2-digit", second: "2-digit",
      })}
    </span>
  );
}

export default function Layout({ children, connected, threatLevel }: Props) {
  const threatConfig = {
    secure:   { color: "#10b981", text: "SYSTEM SECURE",   Icon: Shield,     glow: "#10b981" },
    warning:  { color: "#f97316", text: "ALERT ACTIVE",    Icon: ShieldAlert, glow: "#f97316" },
    critical: { color: "#ef4444", text: "THREAT DETECTED", Icon: ShieldX,    glow: "#ef4444" },
  }[threatLevel];

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#060a12", color: "#e2e8f0" }}>
      {/* Sidebar */}
      <aside style={{
        width: 240,
        minWidth: 240,
        background: "linear-gradient(180deg, #080d1a 0%, #060a12 100%)",
        borderRight: "1px solid rgba(255,255,255,0.06)",
        display: "flex",
        flexDirection: "column",
        padding: "24px 14px 20px",
        position: "fixed",
        top: 0, left: 0,
        height: "100vh",
        zIndex: 100,
      }}>
        {/* Logo */}
        <div style={{ marginBottom: 36, paddingLeft: 4 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 8,
              background: "linear-gradient(135deg, #1d4ed8, #4f46e5)",
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: "0 4px 15px rgba(59,130,246,0.4)",
            }}>
              <Radio size={16} color="#fff" />
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: 18, letterSpacing: 2, lineHeight: 1 }}>
                CROWD<span style={{ color: "#3b82f6" }}>LENS</span>
              </div>
            </div>
          </div>
          <div style={{ fontSize: 10, color: "#334155", letterSpacing: 2, fontWeight: 600, paddingLeft: 42 }}>
            CAMPUS AI MONITOR
          </div>
        </div>

        {/* Section label */}
        <div style={{ fontSize: 9, color: "#334155", letterSpacing: 2, fontWeight: 700, marginBottom: 8, paddingLeft: 4 }}>
          NAVIGATION
        </div>

        {/* Nav */}
        <nav style={{ flex: 1 }}>
          {navItems.map((item) => <NavItem key={item.path} {...item} />)}
        </nav>

        {/* Divider */}
        <div style={{ height: 1, background: "rgba(255,255,255,0.06)", margin: "16px 0" }} />

        {/* Connection status */}
        <div style={{
          background: "rgba(255,255,255,0.03)",
          border: "1px solid rgba(255,255,255,0.06)",
          borderRadius: 10,
          padding: "12px 14px",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
            {connected
              ? <Wifi size={14} color="#10b981" />
              : <WifiOff size={14} color="#475569" />}
            <span style={{
              fontSize: 11, fontWeight: 700, letterSpacing: 0.5,
              color: connected ? "#10b981" : "#475569",
            }}>
              {connected ? "ENGINE CONNECTED" : "RECONNECTING…"}
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{
              width: 6, height: 6, borderRadius: "50%",
              background: connected ? "#10b981" : "#475569",
              boxShadow: connected ? "0 0 8px #10b981" : "none",
              animation: connected ? "pulse-dot 2s infinite" : "none",
              flexShrink: 0,
            }} />
            <span style={{ fontSize: 10, color: "#475569" }}>
              {connected ? "YOLOv8n · SORT Tracking" : "Waiting for backend…"}
            </span>
          </div>
        </div>

        <style>{`
          @keyframes pulse-dot {
            0%, 100% { opacity: 1; box-shadow: 0 0 8px #10b981; }
            50% { opacity: 0.7; box-shadow: 0 0 16px #10b981; }
          }
        `}</style>
      </aside>

      {/* Main */}
      <div style={{ marginLeft: 240, flex: 1, display: "flex", flexDirection: "column", minHeight: "100vh" }}>
        {/* Header */}
        <header style={{
          background: "rgba(8,13,26,0.85)",
          backdropFilter: "blur(12px)",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          padding: "0 28px",
          height: 56,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          position: "sticky",
          top: 0,
          zIndex: 50,
        }}>
          <div style={{ fontSize: 12, color: "#475569", fontVariantNumeric: "tabular-nums" }}>
            <Clock />
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            {/* Activity indicator */}
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <Activity size={14} color="#3b82f6" style={{ opacity: 0.8 }} />
              <span style={{ fontSize: 11, color: "#475569" }}>Detection Engine</span>
            </div>

            <div style={{ width: 1, height: 20, background: "rgba(255,255,255,0.08)" }} />

            {/* Threat status */}
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <threatConfig.Icon size={15} color={threatConfig.color} />
              <span style={{
                fontSize: 12, fontWeight: 700, color: threatConfig.color,
                letterSpacing: 1,
                animation: threatLevel !== "secure" ? "blink 1.2s infinite" : "none",
                textShadow: threatLevel !== "secure" ? `0 0 12px ${threatConfig.glow}` : "none",
              }}>
                {threatConfig.text}
              </span>
              <div style={{
                width: 8, height: 8, borderRadius: "50%",
                background: threatConfig.color,
                boxShadow: `0 0 8px ${threatConfig.glow}`,
                animation: threatLevel !== "secure" ? "blink 1s infinite" : "none",
              }} />
            </div>
          </div>
        </header>

        <main style={{ flex: 1, padding: "28px", background: "#060a12" }}>{children}</main>
      </div>
    </div>
  );
}
