import { useEffect, useState } from "react";
import { Sliders, Users, Zap, Clock, Move, CheckCircle, Package } from "lucide-react";

interface Config {
  overcrowding_threshold: number;
  running_speed_threshold: number;
  unattended_object_time: number;
  stationary_threshold: number;
}

const COCO_CLASSES = [
  { id: 0,  name: "Person",     color: "#10b981", icon: "👤" },
  { id: 24, name: "Backpack",   color: "#f59e0b", icon: "🎒" },
  { id: 26, name: "Handbag",    color: "#f59e0b", icon: "👜" },
  { id: 28, name: "Suitcase",   color: "#f59e0b", icon: "🧳" },
  { id: 39, name: "Bottle",     color: "#f59e0b", icon: "🍶" },
  { id: 41, name: "Cup",        color: "#f59e0b", icon: "☕" },
  { id: 67, name: "Cell Phone", color: "#f59e0b", icon: "📱" },
  { id: 73, name: "Book",       color: "#f59e0b", icon: "📖" },
];

function PremiumSlider({
  label, description, icon: Icon, color, value, min, max, step, onChange, unit,
}: {
  label: string;
  description: string;
  icon: typeof Sliders;
  color: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  unit?: string;
}) {
  const pct = ((value - min) / (max - min)) * 100;

  return (
    <div style={{ marginBottom: 28 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
          <div style={{
            background: color + "18", borderRadius: 8, padding: 7, marginTop: 1,
          }}>
            <Icon size={14} color={color} />
          </div>
          <div>
            <div style={{ fontWeight: 600, fontSize: 14, color: "#e2e8f0", marginBottom: 3 }}>{label}</div>
            <div style={{ fontSize: 11, color: "#475569", lineHeight: 1.5 }}>{description}</div>
          </div>
        </div>
        <div style={{
          background: color + "18",
          border: `1px solid ${color}33`,
          borderRadius: 10,
          padding: "6px 16px",
          fontSize: 20,
          fontWeight: 800,
          color,
          minWidth: 90,
          textAlign: "center",
          textShadow: `0 0 14px ${color}55`,
        }}>
          {value}{unit ?? ""}
        </div>
      </div>

      <div style={{ position: "relative", height: 6, background: "rgba(255,255,255,0.06)", borderRadius: 3 }}>
        <div style={{
          position: "absolute", left: 0, top: 0, bottom: 0,
          width: `${pct}%`,
          background: `linear-gradient(90deg, ${color}88, ${color})`,
          borderRadius: 3,
          transition: "width 0.1s",
        }} />
        <input
          type="range"
          min={min} max={max} step={step} value={value}
          onChange={e => onChange(Number(e.target.value))}
          style={{
            position: "absolute", inset: 0, width: "100%", opacity: 0,
            cursor: "pointer", height: "100%",
          }}
        />
        <div style={{
          position: "absolute",
          left: `${pct}%`,
          top: "50%",
          transform: "translate(-50%, -50%)",
          width: 14, height: 14,
          background: color,
          borderRadius: "50%",
          border: "2px solid #060a12",
          boxShadow: `0 0 8px ${color}`,
          pointerEvents: "none",
        }} />
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#334155", marginTop: 8 }}>
        <span>{min}{unit}</span>
        <span>{max}{unit}</span>
      </div>
    </div>
  );
}

export default function Settings() {
  const [config, setConfig] = useState<Config>({
    overcrowding_threshold: 2,
    running_speed_threshold: 20,
    unattended_object_time: 5,
    stationary_threshold: 150,
  });
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/config")
      .then(r => r.json())
      .then(data => { setConfig(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    await fetch("/api/config", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(config),
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", padding: 60 }}>
        <div style={{ color: "#334155", fontSize: 13 }}>Loading configuration…</div>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "#f1f5f9", letterSpacing: -0.5, marginBottom: 4 }}>
            Detection Settings
          </h1>
          <p style={{ color: "#475569", fontSize: 13 }}>
            Configure anomaly detection thresholds — changes apply in real time
          </p>
        </div>
        <button
          onClick={handleSave}
          style={{
            display: "flex", alignItems: "center", gap: 8,
            padding: "10px 24px", borderRadius: 10,
            background: saved
              ? "linear-gradient(135deg, #059669, #10b981)"
              : "linear-gradient(135deg, #1d4ed8, #3b82f6)",
            color: "#fff", border: "none",
            fontWeight: 700, fontSize: 14, cursor: "pointer",
            boxShadow: saved ? "0 4px 20px #10b98155" : "0 4px 20px #3b82f655",
            transition: "all 0.3s",
          }}
        >
          {saved ? <CheckCircle size={15} /> : <Sliders size={15} />}
          {saved ? "Applied!" : "Apply Settings"}
        </button>
      </div>

      {/* Threshold panels */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 20 }}>
        {/* Crowd & Occupancy */}
        <div style={{
          background: "rgba(255,255,255,0.025)",
          border: "1px solid rgba(255,255,255,0.07)",
          borderRadius: 14, padding: "24px",
        }}>
          <div style={{ fontSize: 9, color: "#475569", letterSpacing: 2, fontWeight: 700, marginBottom: 24 }}>
            CROWD & OCCUPANCY
          </div>

          <PremiumSlider
            label="Overcrowding Threshold"
            description="Alert when more than N people are detected in frame"
            icon={Users}
            color="#f97316"
            value={config.overcrowding_threshold}
            min={1} max={20} step={1}
            onChange={v => setConfig(c => ({ ...c, overcrowding_threshold: v }))}
            unit=" ppl"
          />

          <PremiumSlider
            label="Stationary Distance Limit"
            description="Maximum movement (px) before an object is no longer considered stationary"
            icon={Move}
            color="#3b82f6"
            value={config.stationary_threshold}
            min={20} max={300} step={10}
            onChange={v => setConfig(c => ({ ...c, stationary_threshold: v }))}
            unit="px"
          />
        </div>

        {/* Motion & Objects */}
        <div style={{
          background: "rgba(255,255,255,0.025)",
          border: "1px solid rgba(255,255,255,0.07)",
          borderRadius: 14, padding: "24px",
        }}>
          <div style={{ fontSize: 9, color: "#475569", letterSpacing: 2, fontWeight: 700, marginBottom: 24 }}>
            MOTION & OBJECTS
          </div>

          <PremiumSlider
            label="Running Speed Threshold"
            description="Pixel-per-frame speed above which a person is flagged as running"
            icon={Zap}
            color="#a855f7"
            value={config.running_speed_threshold}
            min={5} max={100} step={1}
            onChange={v => setConfig(c => ({ ...c, running_speed_threshold: v }))}
            unit="px/f"
          />

          <PremiumSlider
            label="Unattended Object Time"
            description="Seconds an object must remain stationary before triggering an alert"
            icon={Clock}
            color="#ef4444"
            value={config.unattended_object_time}
            min={1} max={30} step={1}
            onChange={v => setConfig(c => ({ ...c, unattended_object_time: v }))}
            unit="s"
          />
        </div>
      </div>

      {/* Detection Classes */}
      <div style={{
        background: "rgba(255,255,255,0.025)",
        border: "1px solid rgba(255,255,255,0.07)",
        borderRadius: 14, padding: "24px",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
          <Package size={14} color="#475569" />
          <div style={{ fontSize: 9, color: "#475569", letterSpacing: 2, fontWeight: 700 }}>
            MONITORED DETECTION CLASSES
          </div>
          <div style={{
            marginLeft: "auto",
            background: "rgba(59,130,246,0.1)",
            color: "#3b82f6",
            fontSize: 9, fontWeight: 800,
            padding: "2px 8px", borderRadius: 10, letterSpacing: 1,
          }}>
            COCO DATASET
          </div>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
          {COCO_CLASSES.map(cls => (
            <div
              key={cls.id}
              style={{
                background: cls.color + "10",
                color: cls.color,
                border: `1px solid ${cls.color}30`,
                borderRadius: 10,
                padding: "8px 14px",
                fontSize: 12,
                fontWeight: 600,
                display: "flex",
                alignItems: "center",
                gap: 7,
              }}
            >
              <span style={{ fontSize: 15 }}>{cls.icon}</span>
              {cls.name}
              <span style={{
                background: "rgba(0,0,0,0.3)",
                color: "#475569",
                fontSize: 9, fontWeight: 700,
                padding: "1px 6px", borderRadius: 6,
              }}>
                ID:{cls.id}
              </span>
            </div>
          ))}
        </div>
        <div style={{ fontSize: 11, color: "#1e3a5f", marginTop: 14 }}>
          These COCO class IDs are tracked by the YOLOv4-tiny detection pipeline (OpenCV DNN + SORT). Objects
          that remain stationary beyond the configured time trigger unattended object alerts.
        </div>
      </div>
    </div>
  );
}
