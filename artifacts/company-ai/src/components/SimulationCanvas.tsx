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
  color: string, size = 14
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

interface Props {
  tracks: Track[];
  anomalies: Anomaly[];
  cameraMode: "simulation" | "webcam";
  videoRef: React.RefObject<HTMLVideoElement | null>;
  sourceMode?: "simulation" | "video";
}

export default function SimulationCanvas({ tracks, anomalies, cameraMode, videoRef, sourceMode = "simulation" }: Props) {
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

      ctx.clearRect(0, 0, W, H);

      // ── Background ──────────────────────────────────────────
      const vid = videoRef.current;
      const hasVideo = cameraMode === "webcam" && vid && vid.readyState >= 2;

      if (hasVideo) {
        ctx.drawImage(vid, 0, 0, W, H);
        ctx.fillStyle = "rgba(6,10,18,0.35)";
        ctx.fillRect(0, 0, W, H);
      } else {
        const bg = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, 700);
        bg.addColorStop(0, "#0d1525");
        bg.addColorStop(1, "#080c18");
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, W, H);

        // Grid
        ctx.strokeStyle = "rgba(59,130,246,0.07)";
        ctx.lineWidth = 1;
        for (let x = 80; x < W; x += 80) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
        for (let y = 80; y < H; y += 80) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }

        // Zone overlays
        const zones = [
          { label: "ZONE A · ENTRANCE", x: 0,         w: W / 3, color: "rgba(59,130,246,0.07)",  borderColor: "rgba(59,130,246,0.15)" },
          { label: "ZONE B · CORRIDOR", x: W / 3,     w: W / 3, color: "rgba(16,185,129,0.05)",  borderColor: "rgba(16,185,129,0.12)" },
          { label: "ZONE C · EXIT",     x: 2 * W / 3, w: W / 3, color: "rgba(168,85,247,0.06)",  borderColor: "rgba(168,85,247,0.12)" },
        ];
        for (const z of zones) {
          ctx.fillStyle = z.color;
          ctx.fillRect(z.x, 0, z.w, H);
          ctx.strokeStyle = z.borderColor;
          ctx.lineWidth = 1;
          ctx.setLineDash([6, 6]);
          ctx.beginPath(); ctx.moveTo(z.x, 0); ctx.lineTo(z.x, H); ctx.stroke();
          ctx.setLineDash([]);
          ctx.fillStyle = "rgba(148,163,184,0.4)";
          ctx.font = "700 10px 'Inter', monospace";
          ctx.fillText(z.label, z.x + 16, 26);
        }

        // Scan line (simulation mode only)
        if (sourceMode === "simulation") {
          const scanY = (t / 20) % H;
          const sg = ctx.createLinearGradient(0, scanY - 60, 0, scanY + 60);
          sg.addColorStop(0, "rgba(59,130,246,0)");
          sg.addColorStop(0.5, "rgba(59,130,246,0.04)");
          sg.addColorStop(1, "rgba(59,130,246,0)");
          ctx.fillStyle = sg;
          ctx.fillRect(0, scanY - 60, W, 120);
        }
      }

      // ── Bounding boxes ───────────────────────────────────────
      const anomalyIds = getAnomalyIds(anomalies);

      for (const tr of tracks) {
        const isAnomalous = anomalyIds.has(tr.id);
        const isPerson = tr.class_id === 0;
        const isRunning = tr.running;

        let color = isPerson ? "#10b981" : "#f59e0b";
        if (isRunning) color = "#a855f7";
        else if (isAnomalous && !isPerson) color = "#ef4444";
        else if (isAnomalous) color = "#f97316";

        const bw = tr.x2 - tr.x1;
        const bh = tr.y2 - tr.y1;

        if (isAnomalous) { ctx.shadowColor = color; ctx.shadowBlur = 20; }
        ctx.fillStyle = color + (isAnomalous ? "18" : "0e");
        ctx.fillRect(tr.x1, tr.y1, bw, bh);
        ctx.shadowBlur = 0;

        drawCornerMarker(ctx, tr.x1, tr.y1, tr.x2, tr.y2, color, isAnomalous ? 16 : 12);

        // Confidence — real from YOLOv4-tiny, or simulated fallback
        const conf = tr.confidence !== undefined
          ? tr.confidence
          : 0.78 + (tr.id % 17) * 0.012;

        const labelText = isRunning
          ? `⚡ RUNNING  ${(conf * 100).toFixed(0)}%`
          : `${tr.class_name.toUpperCase()}  ${(conf * 100).toFixed(0)}%`;

        ctx.font = "600 11px 'Inter', monospace";
        const tw = ctx.measureText(labelText).width + 12;
        const lx = tr.x1;
        const ly = tr.y1 - 22;
        ctx.fillStyle = color;
        ctx.globalAlpha = 0.9;
        roundRect(ctx, lx, ly, tw, 20, 4);
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.fillStyle = "#fff";
        ctx.font = "600 10px 'Inter', monospace";
        ctx.fillText(labelText, lx + 6, ly + 14);

        // Track ID + zone badge
        const zoneLbl = tr.zone ? ` Z${tr.zone}` : "";
        const idLabel = `#${tr.id}${zoneLbl}`;
        ctx.font = "700 9px monospace";
        const idW = ctx.measureText(idLabel).width + 8;
        ctx.fillStyle = "rgba(0,0,0,0.6)";
        roundRect(ctx, tr.x2 - idW, tr.y2 - 18, idW, 16, 3);
        ctx.fill();
        ctx.fillStyle = color;
        ctx.fillText(idLabel, tr.x2 - idW + 4, tr.y2 - 5);
      }

      // ── Anomaly effects ──────────────────────────────────────
      for (const a of anomalies) {
        if (!a.position) continue;
        const [ax, ay] = a.position;
        const pulse = 0.5 + 0.5 * Math.sin(t / 160);

        if (a.type === "running") {
          for (let r = 0; r < 3; r++) {
            ctx.beginPath();
            ctx.arc(ax, ay, 55 + r * 20 + pulse * 10, 0, 2 * Math.PI);
            ctx.strokeStyle = `rgba(168,85,247,${0.6 - r * 0.18})`;
            ctx.lineWidth = 2 - r * 0.4;
            ctx.setLineDash([6, 4]);
            ctx.stroke();
            ctx.setLineDash([]);
          }
        } else if (a.type === "unattended_object") {
          ctx.beginPath();
          ctx.arc(ax, ay, 48 + pulse * 6, 0, 2 * Math.PI);
          ctx.fillStyle = "rgba(239,68,68,0.1)";
          ctx.fill();
          ctx.strokeStyle = `rgba(239,68,68,${0.7 + pulse * 0.3})`;
          ctx.lineWidth = 2;
          ctx.stroke();
          if (a.duration) {
            ctx.fillStyle = "#ef4444";
            ctx.font = "700 11px monospace";
            ctx.fillText(`⚠ ${a.duration}s`, ax - 20, ay + 66);
          }
        } else if (a.type === "overcrowding") {
          const hg = ctx.createRadialGradient(ax, ay, 0, ax, ay, 120);
          hg.addColorStop(0, `rgba(249,115,22,${0.2 + pulse * 0.1})`);
          hg.addColorStop(1, "rgba(249,115,22,0)");
          ctx.fillStyle = hg;
          ctx.beginPath();
          ctx.arc(ax, ay, 120, 0, 2 * Math.PI);
          ctx.fill();
        }
      }
      ctx.shadowBlur = 0;

      // ── Alert banner ─────────────────────────────────────────
      const hasRunning = anomalies.some(a => a.type === "running");
      const hasUnattended = anomalies.some(a => a.type === "unattended_object");
      const hasOvercrowding = anomalies.some(a => a.type === "overcrowding");

      if (hasRunning || hasUnattended || hasOvercrowding) {
        const bannerColor = hasRunning ? "#a855f7" : hasUnattended ? "#ef4444" : "#f97316";
        const bannerText = hasRunning
          ? "⚡  CRITICAL ALERT · RUNNING DETECTED"
          : hasUnattended
          ? "🚨  SECURITY ALERT · UNATTENDED OBJECT"
          : "⚠  CROWD WARNING · OVERCROWDING DETECTED";

        const pulse = 0.5 + 0.5 * Math.sin(t / 160);
        ctx.fillStyle = bannerColor;
        ctx.globalAlpha = 0.15;
        ctx.fillRect(0, 0, W, 52);
        ctx.globalAlpha = 1;
        ctx.strokeStyle = bannerColor;
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(0, 52); ctx.lineTo(W, 52); ctx.stroke();
        ctx.fillStyle = "#fff";
        ctx.font = "700 18px 'Inter', sans-serif";
        ctx.fillText(bannerText, 24, 34);
        ctx.beginPath();
        ctx.arc(W - 24, 26, 5 + pulse * 2, 0, 2 * Math.PI);
        ctx.fillStyle = bannerColor;
        ctx.globalAlpha = 0.88 + 0.12 * Math.sin(t / 300);
        ctx.fill();
        ctx.globalAlpha = 1;
      }

      // ── Timestamp & mode badge ────────────────────────────────
      ctx.fillStyle = "rgba(0,0,0,0.55)";
      roundRect(ctx, 12, H - 36, 240, 26, 6);
      ctx.fill();
      ctx.fillStyle = "#64748b";
      ctx.font = "11px monospace";
      ctx.fillText(
        `${new Date().toLocaleTimeString("en-IN")}  ·  ${
          sourceMode === "video" ? "YOLO DETECT" : cameraMode === "webcam" ? "CAMERA LIVE" : "SIMULATION"
        }`,
        20, H - 17
      );

      const modeBadge = sourceMode === "video" ? "⚡ YOLO LIVE" : "● REC  LIVE";
      const badgeW = 120;
      ctx.fillStyle = "rgba(0,0,0,0.55)";
      roundRect(ctx, W - badgeW - 12, H - 36, badgeW, 26, 6);
      ctx.fill();
      if (sourceMode !== "video") {
        const recPulse = Math.sin(t / 700) > 0;
        if (recPulse) {
          ctx.fillStyle = "#ef4444";
          ctx.beginPath(); ctx.arc(W - badgeW - 2, H - 23, 5, 0, 2 * Math.PI); ctx.fill();
        }
      }
      ctx.fillStyle = sourceMode === "video" ? "#a855f7" : "#94a3b8";
      ctx.font = "700 10px monospace";
      ctx.fillText(modeBadge, W - badgeW, H - 17);

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
