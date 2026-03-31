import { ReactNode } from "react";
import { Link, useRoute } from "wouter";

interface Props {
  children: ReactNode;
  connected: boolean;
  threatLevel: "secure" | "warning" | "critical";
}

const navItems = [
  { path: "/", label: "Dashboard", icon: "⬛" },
  { path: "/history", label: "Alert History", icon: "📋" },
  { path: "/settings", label: "Settings", icon: "⚙" },
];

function NavItem({ path, label, icon }: { path: string; label: string; icon: string }) {
  const [active] = useRoute(path === "/" ? path : `${path}*`);
  return (
    <Link href={path}>
      <div
        className={`nav-item ${active ? "nav-active" : ""}`}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "11px 18px",
          borderRadius: 8,
          cursor: "pointer",
          marginBottom: 4,
          fontSize: 14,
          fontWeight: active ? 600 : 400,
          background: active ? "rgba(59,130,246,0.15)" : "transparent",
          color: active ? "#60a5fa" : "#94a3b8",
          borderLeft: active ? "3px solid #3b82f6" : "3px solid transparent",
          transition: "all 0.15s",
        }}
      >
        <span style={{ fontSize: 16 }}>{icon}</span>
        {label}
      </div>
    </Link>
  );
}

export default function Layout({ children, connected, threatLevel }: Props) {
  const statusColor =
    threatLevel === "critical" ? "#ef4444" :
    threatLevel === "warning"  ? "#f97316" : "#22c55e";

  const statusText =
    threatLevel === "critical" ? "THREAT DETECTED" :
    threatLevel === "warning"  ? "ALERT ACTIVE" : "SYSTEM SECURE";

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#0f172a" }}>
      <aside
        style={{
          width: 220,
          minWidth: 220,
          background: "#0b1526",
          borderRight: "1px solid #1e293b",
          display: "flex",
          flexDirection: "column",
          padding: "20px 12px",
          position: "fixed",
          top: 0,
          left: 0,
          height: "100vh",
          zIndex: 100,
        }}
      >
        <div style={{ marginBottom: 32 }}>
          <div style={{ fontWeight: 800, fontSize: 17, letterSpacing: 2, color: "#f8fafc" }}>
            CROWD<span style={{ color: "#3b82f6" }}>LENS</span>
          </div>
          <div style={{ fontSize: 10, color: "#475569", letterSpacing: 1, marginTop: 2 }}>
            CAMPUS AI MONITOR
          </div>
        </div>

        <nav style={{ flex: 1 }}>
          {navItems.map((item) => (
            <NavItem key={item.path} {...item} />
          ))}
        </nav>

        <div
          style={{
            padding: "12px 14px",
            borderRadius: 8,
            background: "#1e293b",
            fontSize: 12,
            color: "#64748b",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: connected ? "#22c55e" : "#64748b",
                boxShadow: connected ? "0 0 8px #22c55e" : "none",
                display: "inline-block",
              }}
            />
            <span style={{ color: connected ? "#22c55e" : "#64748b", fontWeight: 600 }}>
              {connected ? "CONNECTED" : "CONNECTING…"}
            </span>
          </div>
          <div>v1.0 · AI Detection Engine</div>
        </div>
      </aside>

      <div style={{ marginLeft: 220, flex: 1, display: "flex", flexDirection: "column" }}>
        <header
          style={{
            background: "#0b1526",
            borderBottom: "1px solid #1e293b",
            padding: "12px 24px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            position: "sticky",
            top: 0,
            zIndex: 50,
          }}
        >
          <div style={{ fontSize: 13, color: "#475569" }}>
            {new Date().toLocaleString("en-IN", {
              weekday: "short", year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit"
            })}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span
              style={{
                width: 10,
                height: 10,
                borderRadius: "50%",
                background: statusColor,
                boxShadow: `0 0 10px ${statusColor}`,
                display: "inline-block",
                animation: threatLevel !== "secure" ? "blink 1s infinite" : "none",
              }}
            />
            <span style={{ fontWeight: 700, color: statusColor, fontSize: 13, letterSpacing: 1 }}>
              {statusText}
            </span>
          </div>
        </header>

        <main style={{ flex: 1, padding: "24px" }}>{children}</main>
      </div>
    </div>
  );
}
