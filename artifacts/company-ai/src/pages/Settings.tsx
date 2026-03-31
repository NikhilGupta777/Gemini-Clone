import { useEffect, useState } from "react";

interface Config {
  overcrowding_threshold: number;
  running_speed_threshold: number;
  unattended_object_time: number;
  stationary_threshold: number;
}

function Slider({
  label, description, value, min, max, step, onChange, unit,
}: {
  label: string;
  description: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  unit?: string;
}) {
  return (
    <div style={{ marginBottom: 28 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
        <div>
          <div style={{ fontWeight: 600, fontSize: 14, color: "#f1f5f9" }}>{label}</div>
          <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>{description}</div>
        </div>
        <div
          style={{
            background: "#0f172a",
            borderRadius: 6,
            padding: "4px 12px",
            fontSize: 18,
            fontWeight: 800,
            color: "#3b82f6",
            minWidth: 70,
            textAlign: "center",
          }}
        >
          {value}{unit ?? ""}
        </div>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ width: "100%", accentColor: "#3b82f6" }}
      />
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#475569", marginTop: 4 }}>
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
      .then((r) => r.json())
      .then((data) => {
        setConfig(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    await fetch("/api/config", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(config),
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  if (loading) return <div style={{ color: "#64748b", padding: 40 }}>Loading config…</div>;

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "#f1f5f9", letterSpacing: 1 }}>
          Detection Settings
        </h1>
        <p style={{ color: "#475569", fontSize: 13, marginTop: 4 }}>
          Configure anomaly detection thresholds in real time
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        <div style={{ background: "#1e293b", borderRadius: 12, padding: "24px" }}>
          <div style={{ fontSize: 11, color: "#64748b", letterSpacing: 1.5, fontWeight: 700, marginBottom: 24 }}>
            CROWD & OCCUPANCY
          </div>

          <Slider
            label="Overcrowding Threshold"
            description="Alert when more than this many people are in frame"
            value={config.overcrowding_threshold}
            min={1}
            max={20}
            step={1}
            onChange={(v) => setConfig((c) => ({ ...c, overcrowding_threshold: v }))}
            unit=" ppl"
          />

          <Slider
            label="Stationary Distance Limit"
            description="Max movement (pixels) before an object is no longer 'stationary'"
            value={config.stationary_threshold}
            min={20}
            max={300}
            step={10}
            onChange={(v) => setConfig((c) => ({ ...c, stationary_threshold: v }))}
            unit="px"
          />
        </div>

        <div style={{ background: "#1e293b", borderRadius: 12, padding: "24px" }}>
          <div style={{ fontSize: 11, color: "#64748b", letterSpacing: 1.5, fontWeight: 700, marginBottom: 24 }}>
            MOTION & OBJECTS
          </div>

          <Slider
            label="Running Speed Threshold"
            description="Pixel-per-frame speed above which a person is flagged as running"
            value={config.running_speed_threshold}
            min={5}
            max={100}
            step={1}
            onChange={(v) => setConfig((c) => ({ ...c, running_speed_threshold: v }))}
            unit="px/f"
          />

          <Slider
            label="Unattended Object Time"
            description="Seconds an object must remain stationary before triggering an alert"
            value={config.unattended_object_time}
            min={1}
            max={30}
            step={1}
            onChange={(v) => setConfig((c) => ({ ...c, unattended_object_time: v }))}
            unit="s"
          />
        </div>
      </div>

      <div style={{ marginTop: 24, display: "flex", alignItems: "center", gap: 14 }}>
        <button
          onClick={handleSave}
          style={{
            padding: "10px 28px",
            borderRadius: 8,
            background: "#3b82f6",
            color: "#fff",
            border: "none",
            fontWeight: 700,
            fontSize: 14,
            cursor: "pointer",
          }}
        >
          Apply Settings
        </button>
        {saved && (
          <span style={{ color: "#22c55e", fontSize: 13, fontWeight: 600 }}>
            ✓ Settings applied successfully
          </span>
        )}
      </div>

      <div style={{ marginTop: 30, background: "#1e293b", borderRadius: 12, padding: "18px 24px" }}>
        <div style={{ fontSize: 11, color: "#64748b", letterSpacing: 1.5, fontWeight: 700, marginBottom: 12 }}>
          DETECTION CLASSES
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {[
            { id: 0, name: "Person", color: "#22c55e" },
            { id: 24, name: "Backpack", color: "#eab308" },
            { id: 26, name: "Handbag", color: "#eab308" },
            { id: 28, name: "Suitcase", color: "#eab308" },
            { id: 39, name: "Bottle", color: "#eab308" },
            { id: 41, name: "Cup", color: "#eab308" },
            { id: 67, name: "Cell Phone", color: "#eab308" },
            { id: 73, name: "Book", color: "#eab308" },
          ].map((cls) => (
            <div
              key={cls.id}
              style={{
                background: cls.color + "22",
                color: cls.color,
                borderRadius: 20,
                padding: "4px 12px",
                fontSize: 12,
                fontWeight: 600,
                border: `1px solid ${cls.color}44`,
              }}
            >
              {cls.name} ({cls.id})
            </div>
          ))}
        </div>
        <div style={{ fontSize: 11, color: "#475569", marginTop: 10 }}>
          COCO class IDs monitored by the anomaly detection engine
        </div>
      </div>
    </div>
  );
}
