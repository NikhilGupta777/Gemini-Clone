import { useEffect, useRef } from "react";
import { Track, Anomaly } from "../hooks/useSimulation";

const W = 1280;
const H = 720;

function getAnomalyIds(anomalies: Anomaly[]): Set<number> {
  const ids = new Set<number>();
  for (const a of anomalies) if (a.track_id !== undefined) ids.add(a.track_id);
  return ids;
}

function drawCornerMarker(
  ctx: CanvasRenderingContext2D,
  x1: number, y1: number, x2: number, y2: number,
  color: string, size = 14,
) {
  ctx.strokeStyle = color;
  ctx.lineWidth = 2.5;
  ctx.lineCap = "square";
  ctx.beginPath(); ctx.moveTo(x1, y1 + size); ctx.lineTo(x1, y1); ctx.lineTo(x1 + size, y1); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x2 - size, y1); ctx.lineTo(x2, y1); ctx.lineTo(x2, y1 + size); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x2, y2 - size); ctx.lineTo(x2, y2); ctx.lineTo(x2 - size, y2); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x1 + size, y2); ctx.lineTo(x1, y2); ctx.lineTo(x1, y2 - size); ctx.stroke();
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

type SourceMode = "simulation" | "video" | "webcam" | "stream";

interface Props {
  tracks: Track[];
  anomalies: Anomaly[];
  cameraMode: "simulation" | "webcam";
  videoRef: React.RefObject<HTMLVideoElement | null>;
  sourceMode?: SourceMode;
}

export default function SimulationCanvas({
  tracks, anomalies, cameraMode, videoRef, sourceMode = "simulation",
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const dataRef = useRef({ tracks, anomalies, cameraMode, sourceMode });

  useEffect(() => {
    dataRef.current = { tracks, anomalies, cameraMode, sourceMode };
  }, [tracks, anomalies, cameraMode, sourceMode]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    function draw() {
      if (!ctx || !canvas) return;
      const { tracks, anomalies, cameraMode, sourceMode } = dataRef.current;
      const t = Date.now();
      const anomalyIds = getAnomalyIds(anomalies);

      ctx.clearRect(0, 0, W, H);

      // ── Background ─────────────────────────────────────────────────────────

      const vid = videoRef.current;
      const hasLiveVideo = cameraMode === "webcam" && vid && vid.readyState >= 2;

      if (hasLiveVideo) {
        // Real webcam: draw actual camera frame + slight dark overlay
        ctx.drawImage(vid, 0, 0, W, H);
        ctx.fillStyle = "rgba(6,10,18,0.25)";
        ctx.fillRect(0, 0, W, H);
      } else if (sourceMode === "video" || sourceMode === "stream") {
        // Server processes video/stream: show dark bg + purple grid (server sends tracks)
        const bg = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, 700);
        bg.addColorStop(0, "#0a0f1f");
        bg.addColorStop(1, "#05080f");
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, W, H);
        ctx.strokeStyle = "rgba(168,85,247,0.06)";
        ctx.lineWidth = 1;
        for (let x = 80; x < W; x += 80) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
        for (let y = 80; y < H; y += 80) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
      } else {
        // Simulation: dark bg with labelled zone overlays
        const bg = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, 700);
        bg.addColorStop(0, "#0d1525");
        bg.addColorStop(1, "#080c18");
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, W, H);
        ctx.strokeStyle = "rgba(59,130,246,0.07)";
        ctx.lineWidth = 1;
        for (let x = 80; x < W; x += 80) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
        for (let y = 80; y < H; y += 80) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }

        const zones = [
          { label: "ZONE A · ENTRANCE", x: 0, w: W / 3, color: "rgba(59,130,246,0.07)", borderColor: "rgba(59,130,246,0.15)" },
          { label: "ZONE B · CORRIDOR", x: W / 3, w: W / 3, color: "rgba(16,185,129,0.05)", borderColor: "rgba(16,185,129,0.12)" },
          { label: "ZONE C · EXIT", x: 2 * W / 3, w: W / 3, color: "rgba(168,85,247,0.06)", borderColor: "rgba(168,85,247,0.12)" },
        ];
        ctx.setLineDash([]);
        for (const z of zones) {
          ctx.fillStyle = z.color;
          ctx.fillRect(z.x, 0, z.w, H);
          ctx.strokeStyle = z.borderColor;
          ctx.lineWidth = 1;
          ctx.setLineDash([6, 6]);
          ctx.beginPath(); ctx.moveTo(z.x + z.w, 0); ctx.lineTo(z.x + z.w, H); ctx.stroke();
          ctx.setLineDash([]);
          ctx.fillStyle = z.borderColor;
          ctx.font = "700 9px monospace";
          ctx.fillText(z.label, z.x + 12, 20);
        }
      }
      ctx.setLineDash([]);

      // ── Tracks ─────────────────────────────────────────────────────────────

      for (const track of tracks) {
        const { x1, y1, x2, y2, class_id, class_name, running, id, confidence } = track;
        const isAnomaly = anomalyIds.has(id);
        const isPerson = class_id === 0;

        let color: string;
        if (running) color = "#ef4444";
        else if (isAnomaly) color = "#f97316";
        else if (isPerson) color = "#3b82f6";
        else color = "#f59e0b";

        if (isAnomaly || running) { ctx.shadowBlur = 18; ctx.shadowColor = color; }

        drawCornerMarker(ctx, x1, y1, x2, y2, color);
        ctx.shadowBlur = 0;

        // Label
        const confStr = confidence !== undefined ? ` ${(confidence * 100).toFixed(0)}%` : "";
        const labelText = `#${id} ${class_name}${confStr}${running ? " RUNNING" : ""}`;
        ctx.font = "600 10px monospace";
        const tw = ctx.measureText(labelText).width;
        const lx = Math.min(x1, W - tw - 14);
        const ly = y1 > 22 ? y1 - 20 : y2 + 4;
        roundRect(ctx, lx - 4, ly - 1, tw + 10, 16, 4);
        ctx.fillStyle = color + "cc";
        ctx.fill();
        ctx.fillStyle = "#fff";
        ctx.fillText(labelText, lx, ly + 11);

        // Running trail
        if (running) {
          const cx = (x1 + x2) / 2;
          const cy = (y1 + y2) / 2;
          ctx.fillStyle = color + "40";
          ctx.globalAlpha = 0.5 + 0.5 * Math.abs(Math.sin(t / 200));
          ctx.beginPath(); ctx.arc(cx, cy, 22, 0, 2 * Math.PI); ctx.fill();
          ctx.globalAlpha = 1;
        }
      }

      // ── Anomaly overlays ────────────────────────────────────────────────────

      for (const anomaly of anomalies) {
        if (!anomaly.position) continue;
        const [ax, ay] = anomaly.position;
        const pulse = 0.5 + 0.5 * Math.sin(t / 350);

        if (anomaly.type === "overcrowding") {
          ctx.strokeStyle = `rgba(239,68,68,${0.3 + 0.3 * pulse})`;
          ctx.lineWidth = 2;
          ctx.setLineDash([8, 6]);
          ctx.beginPath(); ctx.arc(ax, ay, 80, 0, 2 * Math.PI); ctx.stroke();
          ctx.setLineDash([]);
          ctx.fillStyle = `rgba(239,68,68,${0.08 + 0.06 * pulse})`;
          ctx.beginPath(); ctx.arc(ax, ay, 80, 0, 2 * Math.PI); ctx.fill();
          ctx.font = "700 10px monospace";
          ctx.fillStyle = "#ef4444";
          const txt = `⚠ OVERCROWDING${anomaly.count ? ` · ${anomaly.count} PPL` : ""}`;
          ctx.fillText(txt, ax - ctx.measureText(txt).width / 2, ay - 90);
        } else if (anomaly.type === "unattended_object") {
          ctx.strokeStyle = `rgba(249,115,22,${0.4 + 0.3 * pulse})`;
          ctx.lineWidth = 2.5;
          ctx.setLineDash([5, 5]);
          ctx.strokeRect(ax - 30, ay - 30, 60, 60);
          ctx.setLineDash([]);
          ctx.font = "700 10px monospace";
          ctx.fillStyle = "#f97316";
          const txt = "⚠ UNATTENDED OBJECT";
          ctx.fillText(txt, ax - ctx.measureText(txt).width / 2, ay - 38);
        } else if (anomaly.type === "running") {
          ctx.strokeStyle = `rgba(239,68,68,${0.4 + 0.3 * pulse})`;
          ctx.lineWidth = 2;
          ctx.setLineDash([4, 4]);
          if (anomaly.position) {
            ctx.beginPath(); ctx.arc(ax, ay, 50, 0, 2 * Math.PI); ctx.stroke();
          }
          ctx.setLineDash([]);
        }
      }

      // ── HUD ────────────────────────────────────────────────────────────────

      const modeLabel = (() => {
        if (sourceMode === "video") return "YOLO · VIDEO";
        if (sourceMode === "webcam") return "YOLO · WEBCAM";
        if (sourceMode === "stream") return "YOLO · STREAM";
        return "SIMULATION";
      })();

      const modeColor = (() => {
        if (sourceMode === "video") return "#a855f7";
        if (sourceMode === "webcam") return "#10b981";
        if (sourceMode === "stream") return "#f59e0b";
        return "#475569";
      })();

      // Bottom-left: time + mode
      ctx.fillStyle = "rgba(0,0,0,0.6)";
      roundRect(ctx, 12, H - 36, 220, 26, 6);
      ctx.fill();
      ctx.fillStyle = modeColor;
      ctx.font = "11px monospace";
      ctx.fillText(`${new Date().toLocaleTimeString("en-IN")}  ·  ${modeLabel}`, 20, H - 17);

      // Bottom-right: live badge
      const isReal = sourceMode !== "simulation";
      const badgeText = isReal ? "⚡ LIVE DETECT" : "◉ SIM MODE";
      const badgeW = 126;
      ctx.fillStyle = "rgba(0,0,0,0.6)";
      roundRect(ctx, W - badgeW - 12, H - 36, badgeW, 26, 6);
      ctx.fill();

      if (!isReal) {
        const recPulse = Math.sin(t / 700) > 0;
        if (recPulse) {
          ctx.fillStyle = "#334155";
          ctx.beginPath(); ctx.arc(W - badgeW - 2, H - 23, 5, 0, 2 * Math.PI); ctx.fill();
        }
      }

      ctx.fillStyle = modeColor;
      ctx.font = "700 10px monospace";
      ctx.fillText(badgeText, W - badgeW, H - 17);

      rafRef.current = requestAnimationFrame(draw);
    }

    rafRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafRef.current);
  }, [videoRef]);

  return (
    <canvas
      ref={canvasRef}
      width={W}
      height={H}
      style={{ width: "100%", height: "auto", display: "block" }}
    />
  );
}
