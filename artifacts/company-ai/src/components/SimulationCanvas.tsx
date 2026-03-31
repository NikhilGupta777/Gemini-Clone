import { useEffect, useRef, useState, useCallback } from "react";
import { Track, Anomaly } from "../hooks/useSimulation";
import { Camera, CameraOff, Monitor } from "lucide-react";

const W = 1280;
const H = 720;

function getAnomalyIds(anomalies: Anomaly[]): Set<number> {
  const ids = new Set<number>();
  for (const a of anomalies) {
    if (a.track_id !== undefined) ids.add(a.track_id);
  }
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
  // TL
  ctx.beginPath(); ctx.moveTo(x1, y1 + size); ctx.lineTo(x1, y1); ctx.lineTo(x1 + size, y1); ctx.stroke();
  // TR
  ctx.beginPath(); ctx.moveTo(x2 - size, y1); ctx.lineTo(x2, y1); ctx.lineTo(x2, y1 + size); ctx.stroke();
  // BR
  ctx.beginPath(); ctx.moveTo(x2, y2 - size); ctx.lineTo(x2, y2); ctx.lineTo(x2 - size, y2); ctx.stroke();
  // BL
  ctx.beginPath(); ctx.moveTo(x1 + size, y2); ctx.lineTo(x1, y2); ctx.lineTo(x1, y2 - size); ctx.stroke();
}

interface Props {
  tracks: Track[];
  anomalies: Anomaly[];
  cameraMode: "simulation" | "webcam";
  videoRef: React.RefObject<HTMLVideoElement | null>;
}

export default function SimulationCanvas({ tracks, anomalies, cameraMode, videoRef }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const dataRef = useRef({ tracks, anomalies });

  useEffect(() => {
    dataRef.current = { tracks, anomalies };
  }, [tracks, anomalies]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    function draw() {
      if (!ctx || !canvas) return;
      const { tracks, anomalies } = dataRef.current;
      const t = Date.now();

      ctx.clearRect(0, 0, W, H);

      // ── Background ──────────────────────────────────────────
      const vid = videoRef.current;
      const hasVideo = cameraMode === "webcam" && vid && vid.readyState >= 2;

      if (hasVideo) {
        ctx.drawImage(vid, 0, 0, W, H);
        // Dark overlay to make bounding boxes pop
        ctx.fillStyle = "rgba(6,10,18,0.35)";
        ctx.fillRect(0, 0, W, H);
      } else {
        // Dark gradient simulation background
        const bg = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, 700);
        bg.addColorStop(0, "#0d1525");
        bg.addColorStop(1, "#080c18");
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, W, H);

        // Grid - more visible
        ctx.strokeStyle = "rgba(59,130,246,0.07)";
        ctx.lineWidth = 1;
        for (let x = 80; x < W; x += 80) {
          ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
        }
        for (let y = 80; y < H; y += 80) {
          ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
        }
        // Brighter major grid lines every 4
        ctx.strokeStyle = "rgba(59,130,246,0.12)";
        ctx.lineWidth = 1;
        for (let x = 320; x < W; x += 320) {
          ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
        }
        for (let y = 240; y < H; y += 240) {
          ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
        }

        // Zone overlays
        const zones = [
          { label: "ZONE A · ENTRANCE", x: 0,       w: W / 3,   color: "rgba(59,130,246,0.07)",  borderColor: "rgba(59,130,246,0.15)" },
          { label: "ZONE B · CORRIDOR", x: W / 3,   w: W / 3,   color: "rgba(16,185,129,0.05)",  borderColor: "rgba(16,185,129,0.12)" },
          { label: "ZONE C · EXIT",     x: 2*W / 3, w: W / 3,   color: "rgba(168,85,247,0.06)", borderColor: "rgba(168,85,247,0.12)" },
        ];
        for (const z of zones) {
          ctx.fillStyle = z.color;
          ctx.fillRect(z.x, 0, z.w, H);
          // Zone divider
          ctx.strokeStyle = z.borderColor;
          ctx.lineWidth = 1;
          ctx.setLineDash([6, 6]);
          ctx.beginPath(); ctx.moveTo(z.x, 0); ctx.lineTo(z.x, H); ctx.stroke();
          ctx.setLineDash([]);
          // Zone label
          ctx.fillStyle = "rgba(148,163,184,0.4)";
          ctx.font = "700 10px 'Inter', monospace";
          ctx.fillText(z.label, z.x + 16, 26);
        }

        // Scan line
        const scanY = (t / 20) % H;
        const sg = ctx.createLinearGradient(0, scanY - 60, 0, scanY + 60);
        sg.addColorStop(0, "rgba(59,130,246,0)");
        sg.addColorStop(0.5, "rgba(59,130,246,0.04)");
        sg.addColorStop(1, "rgba(59,130,246,0)");
        ctx.fillStyle = sg;
        ctx.fillRect(0, scanY - 60, W, 120);
      }

      // ── Tracking overlays ────────────────────────────────────
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

        // Glow for anomalous
        if (isAnomalous) {
          ctx.shadowColor = color;
          ctx.shadowBlur = 20;
        }

        // Filled box (semi-transparent)
        ctx.fillStyle = color + (isAnomalous ? "18" : "0e");
        ctx.fillRect(tr.x1, tr.y1, bw, bh);

        // Corner markers only (no full border - more premium look)
        ctx.shadowBlur = 0;
        drawCornerMarker(ctx, tr.x1, tr.y1, tr.x2, tr.y2, color, isAnomalous ? 16 : 12);

        // Confidence badge
        const conf = 0.78 + (tr.id % 17) * 0.012;
        const label = isRunning
          ? `⚡ RUNNING  ${(conf * 100).toFixed(0)}%`
          : `${tr.class_name.toUpperCase()}  ${(conf * 100).toFixed(0)}%`;

        ctx.font = "600 11px 'Inter', monospace";
        const tw = ctx.measureText(label).width + 12;

        // Label pill
        const lx = tr.x1;
        const ly = tr.y1 - 22;
        ctx.fillStyle = color;
        ctx.globalAlpha = 0.9;
        roundRect(ctx, lx, ly, tw, 20, 4);
        ctx.fill();
        ctx.globalAlpha = 1;

        ctx.fillStyle = "#fff";
        ctx.font = "600 10px 'Inter', monospace";
        ctx.fillText(label, lx + 6, ly + 14);

        // Track ID badge (small, bottom right of box)
        const idLabel = `#${tr.id}`;
        ctx.fillStyle = "rgba(0,0,0,0.6)";
        const idW = ctx.measureText(idLabel).width + 8;
        roundRect(ctx, tr.x2 - idW, tr.y2 - 18, idW, 16, 3);
        ctx.fill();
        ctx.fillStyle = color;
        ctx.font = "700 9px monospace";
        ctx.fillText(idLabel, tr.x2 - idW + 4, tr.y2 - 5);
      }

      // ── Anomaly pulse rings ──────────────────────────────────
      for (const a of anomalies) {
        if (!a.position) continue;
        const [ax, ay] = a.position;
        const pulse = 0.5 + 0.5 * Math.sin(t / 160);

        if (a.type === "running") {
          for (let r = 0; r < 3; r++) {
            const ringR = 55 + r * 20 + pulse * 10;
            ctx.beginPath();
            ctx.arc(ax, ay, ringR, 0, 2 * Math.PI);
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
          // Warning label
          const durTxt = a.duration ? `${a.duration}s` : "";
          ctx.fillStyle = "#ef4444";
          ctx.font = "700 11px monospace";
          ctx.fillText(`⚠ ${durTxt}`, ax - 20, ay + 66);
        } else if (a.type === "overcrowding") {
          // Heatmap ring
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
          : `⚠  CROWD WARNING · OVERCROWDING DETECTED`;

        const bAlpha = 0.88 + 0.12 * Math.sin(t / 300);
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
        // Pulsing dot
        ctx.beginPath();
        ctx.arc(W - 24, 26, 5 + pulse * 2, 0, 2 * Math.PI);
        ctx.fillStyle = bannerColor;
        ctx.globalAlpha = bAlpha;
        ctx.fill();
        ctx.globalAlpha = 1;
      }

      // ── Overlays (bottom) ────────────────────────────────────
      // Timestamp
      ctx.fillStyle = "rgba(0,0,0,0.55)";
      roundRect(ctx, 12, H - 36, 210, 26, 6);
      ctx.fill();
      ctx.fillStyle = "#64748b";
      ctx.font = "11px monospace";
      ctx.fillText(
        `${new Date().toLocaleTimeString("en-IN")}  ·  ${cameraMode === "webcam" ? "CAMERA LIVE" : "SIMULATION"}`,
        20, H - 17
      );

      // REC dot
      ctx.fillStyle = "rgba(0,0,0,0.55)";
      roundRect(ctx, W - 120, H - 36, 108, 26, 6);
      ctx.fill();
      const recPulse = Math.sin(t / 700) > 0;
      if (recPulse) {
        ctx.fillStyle = "#ef4444";
        ctx.beginPath();
        ctx.arc(W - 108, H - 23, 5, 0, 2 * Math.PI);
        ctx.fill();
      }
      ctx.fillStyle = "#94a3b8";
      ctx.font = "700 10px monospace";
      ctx.fillText("● REC  LIVE", W - 98, H - 17);

      rafRef.current = requestAnimationFrame(draw);
    }

    rafRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafRef.current);
  }, [cameraMode, videoRef]);

  return (
    <canvas
      ref={canvasRef}
      width={W}
      height={H}
      style={{ width: "100%", height: "auto", display: "block" }}
    />
  );
}

// ── Util ─────────────────────────────────────────────────────
function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}
