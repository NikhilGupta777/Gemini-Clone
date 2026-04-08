import { useEffect, useState } from "react";
import { useIsMobile } from "../hooks/use-mobile";
import {
  CheckCircle,
  Clock,
  Move,
  Package,
  ShieldAlert,
  Sliders,
  UserRoundX,
  Users,
  Zap,
} from "lucide-react";

interface Config {
  overcrowding_threshold: number;
  running_speed_threshold: number;
  unattended_object_time: number;
  stationary_threshold: number;
  unattended_owner_proximity_px: number;
  unattended_owner_grace_time: number;
  fall_aspect_ratio_threshold: number;
  fall_persistence_time: number;
  restricted_zone_enabled: boolean;
  restricted_zone_min_dwell: number;
  fight_detection_enabled: boolean;
  fight_proximity_px: number;
  fight_min_pair_speed: number;
  fight_persistence_time: number;
  fight_min_hit_streak: number;
  alert_cooldown_secs: number;
}

const DEFAULT_CONFIG: Config = {
  overcrowding_threshold: 4,
  running_speed_threshold: 18,
  unattended_object_time: 5,
  stationary_threshold: 150,
  unattended_owner_proximity_px: 180,
  unattended_owner_grace_time: 2.0,
  fall_aspect_ratio_threshold: 1.45,
  fall_persistence_time: 1.0,
  restricted_zone_enabled: true,
  restricted_zone_min_dwell: 0.6,
  fight_detection_enabled: true,
  fight_proximity_px: 180,
  fight_min_pair_speed: 16,
  fight_persistence_time: 0.8,
  fight_min_hit_streak: 3,
  alert_cooldown_secs: 5,
};

const COCO_CLASSES = [
  { id: 0, name: "Person", color: "#10b981" },
  { id: 24, name: "Backpack", color: "#f59e0b" },
  { id: 26, name: "Handbag", color: "#f59e0b" },
  { id: 28, name: "Suitcase", color: "#f59e0b" },
  { id: 39, name: "Bottle", color: "#f59e0b" },
  { id: 41, name: "Cup", color: "#f59e0b" },
  { id: 67, name: "Cell Phone", color: "#f59e0b" },
  { id: 73, name: "Book", color: "#f59e0b" },
];

function PremiumSlider({
  label,
  description,
  icon: Icon,
  color,
  value,
  min,
  max,
  step,
  onChange,
  unit,
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
          <div style={{ background: `${color}18`, borderRadius: 8, padding: 7, marginTop: 1 }}>
            <Icon size={14} color={color} />
          </div>
          <div>
            <div style={{ fontWeight: 600, fontSize: 14, color: "#e2e8f0", marginBottom: 3 }}>{label}</div>
            <div style={{ fontSize: 11, color: "#475569", lineHeight: 1.5 }}>{description}</div>
          </div>
        </div>
        <div
          style={{
            background: `${color}18`,
            border: `1px solid ${color}33`,
            borderRadius: 10,
            padding: "6px 16px",
            fontSize: 20,
            fontWeight: 800,
            color,
            minWidth: 90,
            textAlign: "center",
            textShadow: `0 0 14px ${color}55`,
          }}
        >
          {value}
          {unit ?? ""}
        </div>
      </div>

      <div style={{ position: "relative", height: 6, background: "rgba(255,255,255,0.06)", borderRadius: 3 }}>
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            bottom: 0,
            width: `${pct}%`,
            background: `linear-gradient(90deg, ${color}88, ${color})`,
            borderRadius: 3,
            transition: "width 0.1s",
          }}
        />
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            opacity: 0,
            cursor: "pointer",
            height: "100%",
          }}
        />
        <div
          style={{
            position: "absolute",
            left: `${pct}%`,
            top: "50%",
            transform: "translate(-50%, -50%)",
            width: 14,
            height: 14,
            background: color,
            borderRadius: "50%",
            border: "2px solid #060a12",
            boxShadow: `0 0 8px ${color}`,
            pointerEvents: "none",
          }}
        />
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#334155", marginTop: 8 }}>
        <span>{min}{unit}</span>
        <span>{max}{unit}</span>
      </div>
    </div>
  );
}

function ToggleCard({
  label,
  description,
  enabled,
  onToggle,
}: {
  label: string;
  description: string;
  enabled: boolean;
  onToggle: (next: boolean) => void;
}) {
  return (
    <div
      style={{
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 10,
        background: enabled ? "rgba(16,185,129,0.08)" : "rgba(255,255,255,0.02)",
        padding: "12px 14px",
        marginBottom: 18,
      }}
    >
      <label style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, cursor: "pointer" }}>
        <div>
          <div style={{ color: "#e2e8f0", fontWeight: 600, fontSize: 13, marginBottom: 3 }}>{label}</div>
          <div style={{ color: "#475569", fontSize: 11, lineHeight: 1.4 }}>{description}</div>
        </div>
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => onToggle(e.target.checked)}
          style={{ width: 16, height: 16, cursor: "pointer" }}
        />
      </label>
    </div>
  );
}

export default function Settings() {
  const isMobile = useIsMobile();
  const [config, setConfig] = useState<Config>(DEFAULT_CONFIG);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/config")
      .then((r) => r.json())
      .then((data) => {
        setConfig({
          ...DEFAULT_CONFIG,
          ...data,
        });
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaveError(null);
    try {
      const response = await fetch("/api/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.detail ?? "Unable to save settings");
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err: unknown) {
      setSaveError(err instanceof Error ? err.message : "Unable to save settings");
    }
  };

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", padding: 60 }}>
        <div style={{ color: "#334155", fontSize: 13 }}>Loading configuration...</div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "#f1f5f9", letterSpacing: -0.5, marginBottom: 4 }}>
            Detection Settings
          </h1>
          <p style={{ color: "#475569", fontSize: 13 }}>
            Configure anomaly thresholds for crowding, motion, fall detection, and digital fencing.
          </p>
        </div>

        <button
          onClick={handleSave}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "10px 24px",
            borderRadius: 10,
            background: saved
              ? "linear-gradient(135deg, #059669, #10b981)"
              : "linear-gradient(135deg, #1d4ed8, #3b82f6)",
            color: "#fff",
            border: "none",
            fontWeight: 700,
            fontSize: 14,
            cursor: "pointer",
            boxShadow: saved ? "0 4px 20px #10b98155" : "0 4px 20px #3b82f655",
            transition: "all 0.3s",
          }}
        >
          {saved ? <CheckCircle size={15} /> : <Sliders size={15} />}
          {saved ? "Applied" : "Apply Settings"}
        </button>
      </div>

      {saveError && (
        <div style={{ color: "#ef4444", fontSize: 12, marginBottom: 12 }}>{saveError}</div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 20, marginBottom: 20 }}>
        <div
          style={{
            background: "rgba(255,255,255,0.025)",
            border: "1px solid rgba(255,255,255,0.07)",
            borderRadius: 14,
            padding: 24,
          }}
        >
          <div style={{ fontSize: 9, color: "#475569", letterSpacing: 2, fontWeight: 700, marginBottom: 24 }}>
            CROWD AND OCCUPANCY
          </div>

          <PremiumSlider
            label="Overcrowding Threshold"
            description="Trigger alert when persons in frame exceed this value."
            icon={Users}
            color="#f97316"
            value={config.overcrowding_threshold}
            min={1}
            max={20}
            step={1}
            onChange={(v) => setConfig((c) => ({ ...c, overcrowding_threshold: v }))}
            unit=" ppl"
          />

          <PremiumSlider
            label="Stationary Distance Limit"
            description="Movement below this pixel distance is treated as stationary."
            icon={Move}
            color="#3b82f6"
            value={config.stationary_threshold}
            min={20}
            max={300}
            step={10}
            onChange={(v) => setConfig((c) => ({ ...c, stationary_threshold: v }))}
            unit=" px"
          />
        </div>

        <div
          style={{
            background: "rgba(255,255,255,0.025)",
            border: "1px solid rgba(255,255,255,0.07)",
            borderRadius: 14,
            padding: 24,
          }}
        >
          <div style={{ fontSize: 9, color: "#475569", letterSpacing: 2, fontWeight: 700, marginBottom: 24 }}>
            MOTION AND OBJECTS
          </div>

          <PremiumSlider
            label="Running Speed Threshold"
            description="Average pixel-per-frame speed above this is flagged as running."
            icon={Zap}
            color="#a855f7"
            value={config.running_speed_threshold}
            min={5}
            max={100}
            step={1}
            onChange={(v) => setConfig((c) => ({ ...c, running_speed_threshold: v }))}
            unit=" px/f"
          />

          <PremiumSlider
            label="Unattended Object Time"
            description="Seconds an object must remain still before alerting."
            icon={Clock}
            color="#ef4444"
            value={config.unattended_object_time}
            min={1}
            max={30}
            step={1}
            onChange={(v) => setConfig((c) => ({ ...c, unattended_object_time: v }))}
            unit=" s"
          />

          <PremiumSlider
            label="Owner Proximity Radius"
            description="Object is treated as attended if any person is within this radius."
            icon={Users}
            color="#f97316"
            value={config.unattended_owner_proximity_px}
            min={40}
            max={350}
            step={10}
            onChange={(v) => setConfig((c) => ({ ...c, unattended_owner_proximity_px: v }))}
            unit=" px"
          />

          <PremiumSlider
            label="Owner Absence Grace Time"
            description="Person must be away for this long before unattended alerting starts."
            icon={Clock}
            color="#ef4444"
            value={config.unattended_owner_grace_time}
            min={0.5}
            max={10}
            step={0.1}
            onChange={(v) => setConfig((c) => ({ ...c, unattended_owner_grace_time: Number(v.toFixed(1)) }))}
            unit=" s"
          />
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 20, marginBottom: 20 }}>
        <div
          style={{
            background: "rgba(255,255,255,0.025)",
            border: "1px solid rgba(255,255,255,0.07)",
            borderRadius: 14,
            padding: 24,
          }}
        >
          <div style={{ fontSize: 9, color: "#475569", letterSpacing: 2, fontWeight: 700, marginBottom: 24 }}>
            FALL DETECTION
          </div>

          <PremiumSlider
            label="Fall Aspect-Ratio Threshold"
            description="Person width/height ratio above this value indicates possible fall posture."
            icon={UserRoundX}
            color="#dc2626"
            value={config.fall_aspect_ratio_threshold}
            min={0.8}
            max={3}
            step={0.05}
            onChange={(v) => setConfig((c) => ({ ...c, fall_aspect_ratio_threshold: Number(v.toFixed(2)) }))}
          />

          <PremiumSlider
            label="Fall Persistence Window"
            description="Seconds posture must persist before emitting a fall alert."
            icon={Clock}
            color="#dc2626"
            value={config.fall_persistence_time}
            min={0.2}
            max={5}
            step={0.1}
            onChange={(v) => setConfig((c) => ({ ...c, fall_persistence_time: Number(v.toFixed(1)) }))}
            unit=" s"
          />
        </div>

        <div
          style={{
            background: "rgba(255,255,255,0.025)",
            border: "1px solid rgba(255,255,255,0.07)",
            borderRadius: 14,
            padding: 24,
          }}
        >
          <div style={{ fontSize: 9, color: "#475569", letterSpacing: 2, fontWeight: 700, marginBottom: 24 }}>
            DIGITAL FENCING
          </div>

          <ToggleCard
            label="Restricted Zone Monitoring"
            description="Detect people entering configured restricted regions."
            enabled={config.restricted_zone_enabled}
            onToggle={(next) => setConfig((c) => ({ ...c, restricted_zone_enabled: next }))}
          />

          <PremiumSlider
            label="Restricted Zone Dwell Time"
            description="Minimum time inside restricted region before raising alert."
            icon={ShieldAlert}
            color="#eab308"
            value={config.restricted_zone_min_dwell}
            min={0.2}
            max={10}
            step={0.1}
            onChange={(v) => setConfig((c) => ({ ...c, restricted_zone_min_dwell: Number(v.toFixed(1)) }))}
            unit=" s"
          />
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 20, marginBottom: 20 }}>
        <div
          style={{
            background: "rgba(255,255,255,0.025)",
            border: "1px solid rgba(255,255,255,0.07)",
            borderRadius: 14,
            padding: 24,
          }}
        >
          <div style={{ fontSize: 9, color: "#475569", letterSpacing: 2, fontWeight: 700, marginBottom: 24 }}>
            FIGHT PROTOTYPE
          </div>

          <ToggleCard
            label="Fight Suspicion Monitoring"
            description="Heuristic pair-motion detector for close high-speed person interactions."
            enabled={config.fight_detection_enabled}
            onToggle={(next) => setConfig((c) => ({ ...c, fight_detection_enabled: next }))}
          />

          <PremiumSlider
            label="Fight Pair Proximity"
            description="Maximum distance between two persons to consider a possible fight pair."
            icon={Users}
            color="#f43f5e"
            value={config.fight_proximity_px}
            min={60}
            max={320}
            step={10}
            onChange={(v) => setConfig((c) => ({ ...c, fight_proximity_px: v }))}
            unit=" px"
          />

          <PremiumSlider
            label="Fight Pair Speed"
            description="Both persons must exceed this average speed for suspicion."
            icon={Zap}
            color="#f43f5e"
            value={config.fight_min_pair_speed}
            min={6}
            max={80}
            step={1}
            onChange={(v) => setConfig((c) => ({ ...c, fight_min_pair_speed: v }))}
            unit=" px/f"
          />

          <PremiumSlider
            label="Fight Persistence"
            description="How long suspicious pair behavior must continue before alert."
            icon={Clock}
            color="#f43f5e"
            value={config.fight_persistence_time}
            min={0.2}
            max={5}
            step={0.1}
            onChange={(v) => setConfig((c) => ({ ...c, fight_persistence_time: Number(v.toFixed(1)) }))}
            unit=" s"
          />

          <PremiumSlider
            label="Fight Min Track Stability"
            description="Minimum tracker hit-streak for each person before pair evaluation."
            icon={CheckCircle}
            color="#f43f5e"
            value={config.fight_min_hit_streak}
            min={1}
            max={10}
            step={1}
            onChange={(v) => setConfig((c) => ({ ...c, fight_min_hit_streak: v }))}
          />
        </div>
      </div>

      <div
        style={{
          background: "rgba(255,255,255,0.025)",
          border: "1px solid rgba(255,255,255,0.07)",
          borderRadius: 14,
          padding: 24,
          marginBottom: 20,
        }}
      >
        <div style={{ fontSize: 9, color: "#475569", letterSpacing: 2, fontWeight: 700, marginBottom: 24 }}>
          ALERT BEHAVIOUR
        </div>

        <PremiumSlider
          label="Alert Cooldown"
          description="Minimum seconds between repeat alerts of the same type for the same track. Lower values increase sensitivity; higher values reduce noise."
          icon={Clock}
          color="#3b82f6"
          value={config.alert_cooldown_secs}
          min={1}
          max={60}
          step={1}
          onChange={(v) => setConfig((c) => ({ ...c, alert_cooldown_secs: v }))}
          unit=" s"
        />
      </div>

      <div
        style={{
          background: "rgba(255,255,255,0.025)",
          border: "1px solid rgba(255,255,255,0.07)",
          borderRadius: 14,
          padding: 24,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
          <Package size={14} color="#475569" />
          <div style={{ fontSize: 9, color: "#475569", letterSpacing: 2, fontWeight: 700 }}>
            MONITORED DETECTION CLASSES
          </div>
          <div
            style={{
              marginLeft: "auto",
              background: "rgba(59,130,246,0.1)",
              color: "#3b82f6",
              fontSize: 9,
              fontWeight: 800,
              padding: "2px 8px",
              borderRadius: 10,
              letterSpacing: 1,
            }}
          >
            COCO DATASET
          </div>
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
          {COCO_CLASSES.map((item) => (
            <div
              key={item.id}
              style={{
                background: `${item.color}10`,
                color: item.color,
                border: `1px solid ${item.color}30`,
                borderRadius: 10,
                padding: "8px 14px",
                fontSize: 12,
                fontWeight: 600,
                display: "flex",
                alignItems: "center",
                gap: 7,
              }}
            >
              {item.name}
              <span
                style={{
                  background: "rgba(0,0,0,0.3)",
                  color: "#475569",
                  fontSize: 9,
                  fontWeight: 700,
                  padding: "1px 6px",
                  borderRadius: 6,
                }}
              >
                ID:{item.id}
              </span>
            </div>
          ))}
        </div>

        <div style={{ fontSize: 11, color: "#1e3a5f", marginTop: 14 }}>
          Person and unattended-object classes are tracked by YOLO11m plus SORT. Fall, restricted-zone, and
          fight-suspicion prototype settings are active immediately after applying this configuration.
        </div>
      </div>
    </div>
  );
}
