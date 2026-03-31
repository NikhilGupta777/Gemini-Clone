import { useEffect, useRef } from "react";
import { Track, Anomaly } from "../hooks/useSimulation";

const W = 1280;
const H = 720;

function getAnomalyIds(anomalies: Anomaly[]): Set<number> {
  const ids = new Set<number>();
  for (const a of anomalies) {
    if (a.track_id !== undefined) ids.add(a.track_id);
  }
  return ids;
}

interface Props {
  tracks: Track[];
  anomalies: Anomaly[];
}

export default function SimulationCanvas({ tracks, anomalies }: Props) {
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

      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = "#050d1a";
      ctx.fillRect(0, 0, W, H);

      ctx.strokeStyle = "rgba(51,65,85,0.4)";
      ctx.lineWidth = 1;
      const gridSize = 80;
      for (let x = gridSize; x < W; x += gridSize) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
      }
      for (let y = gridSize; y < H; y += gridSize) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
      }

      const zones = [
        { label: "ZONE A", x: 0, w: W / 3, color: "rgba(59,130,246,0.06)" },
        { label: "ZONE B", x: W / 3, w: W / 3, color: "rgba(34,197,94,0.04)" },
        { label: "ZONE C", x: (2 * W) / 3, w: W / 3, color: "rgba(168,85,247,0.06)" },
      ];
      for (const z of zones) {
        ctx.fillStyle = z.color;
        ctx.fillRect(z.x, 0, z.w, H);
        ctx.fillStyle = "rgba(148,163,184,0.3)";
        ctx.font = "bold 13px Segoe UI";
        ctx.fillText(z.label, z.x + 14, 26);
      }

      const scanY = (Date.now() / 18) % H;
      const scanGrad = ctx.createLinearGradient(0, scanY - 40, 0, scanY + 40);
      scanGrad.addColorStop(0, "rgba(34,197,94,0)");
      scanGrad.addColorStop(0.5, "rgba(34,197,94,0.045)");
      scanGrad.addColorStop(1, "rgba(34,197,94,0)");
      ctx.fillStyle = scanGrad;
      ctx.fillRect(0, scanY - 40, W, 80);

      const anomalyIds = getAnomalyIds(anomalies);

      for (const t of tracks) {
        const isAnomalous = anomalyIds.has(t.id);
        const isPerson = t.class_id === 0;

        let boxColor = "#22c55e";
        if (isAnomalous && t.running) boxColor = "#a855f7";
        else if (isAnomalous) boxColor = "#ef4444";
        else if (!isPerson) boxColor = "#eab308";

        const cx = (t.x1 + t.x2) / 2;
        const bw = t.x2 - t.x1;
        const bh = t.y2 - t.y1;

        if (isAnomalous) {
          ctx.shadowColor = boxColor;
          ctx.shadowBlur = 18;
        }

        ctx.strokeStyle = boxColor;
        ctx.lineWidth = isAnomalous ? 2.5 : 1.8;
        ctx.strokeRect(t.x1, t.y1, bw, bh);

        const cs = 10;
        ctx.beginPath();
        ctx.moveTo(t.x1, t.y1 + cs); ctx.lineTo(t.x1, t.y1); ctx.lineTo(t.x1 + cs, t.y1);
        ctx.moveTo(t.x2 - cs, t.y1); ctx.lineTo(t.x2, t.y1); ctx.lineTo(t.x2, t.y1 + cs);
        ctx.moveTo(t.x2, t.y2 - cs); ctx.lineTo(t.x2, t.y2); ctx.lineTo(t.x2 - cs, t.y2);
        ctx.moveTo(t.x1 + cs, t.y2); ctx.lineTo(t.x1, t.y2); ctx.lineTo(t.x1, t.y2 - cs);
        ctx.strokeStyle = boxColor;
        ctx.lineWidth = 2.5;
        ctx.stroke();

        ctx.shadowBlur = 0;
        ctx.shadowColor = "transparent";

        const labelText = t.running
          ? `⚡ RUNNING #${t.id}`
          : `${t.class_name.toUpperCase()} #${t.id}`;
        ctx.font = "bold 11px monospace";
        const labelW = ctx.measureText(labelText).width + 10;
        ctx.fillStyle = boxColor + "cc";
        ctx.fillRect(t.x1, t.y1 - 22, labelW, 20);
        ctx.fillStyle = "#fff";
        ctx.fillText(labelText, t.x1 + 5, t.y1 - 6);

        if (isPerson) {
          ctx.fillStyle = boxColor + "44";
          ctx.beginPath();
          ctx.arc(cx, (t.y1 + t.y2) / 2, 6, 0, 2 * Math.PI);
          ctx.fill();
        }
      }

      for (const a of anomalies) {
        if (!a.position) continue;
        const [ax, ay] = a.position;
        if (a.type === "running") {
          const pulse = 0.5 + 0.5 * Math.sin(Date.now() / 180);
          ctx.beginPath();
          ctx.arc(ax, ay, 52 + pulse * 8, 0, 2 * Math.PI);
          ctx.strokeStyle = `rgba(168,85,247,${0.7 + pulse * 0.3})`;
          ctx.lineWidth = 3;
          ctx.setLineDash([8, 4]);
          ctx.stroke();
          ctx.setLineDash([]);
        } else if (a.type === "unattended_object") {
          ctx.beginPath();
          ctx.arc(ax, ay, 42, 0, 2 * Math.PI);
          ctx.strokeStyle = "#ef4444";
          ctx.lineWidth = 3;
          ctx.stroke();
          ctx.fillStyle = "rgba(239,68,68,0.12)";
          ctx.fill();
          ctx.fillStyle = "#ef4444";
          ctx.font = "bold 12px monospace";
          const dur = a.duration ? `${a.duration}s` : "";
          ctx.fillText(`⚠ ${dur}`, ax - 18, ay + 62);
        }
      }

      const hasRunning = anomalies.some((a) => a.type === "running");
      const hasUnattended = anomalies.some((a) => a.type === "unattended_object");
      const hasOvercrowding = anomalies.some((a) => a.type === "overcrowding");
      const overcrowdCount = anomalies.find((a) => a.type === "overcrowding")?.count;

      if (hasRunning) {
        ctx.fillStyle = "#a855f7";
        ctx.fillRect(0, 0, W, 48);
        ctx.fillStyle = "#fff";
        ctx.font = "bold 20px Segoe UI";
        ctx.fillText("⚡  CRITICAL: RUNNING DETECTED", 30, 32);
      } else if (hasUnattended) {
        ctx.fillStyle = "#ef4444";
        ctx.fillRect(0, 0, W, 48);
        ctx.fillStyle = "#fff";
        ctx.font = "bold 20px Segoe UI";
        ctx.fillText("🚨  ALERT: UNATTENDED OBJECT", 30, 32);
      } else if (hasOvercrowding) {
        ctx.fillStyle = "#f97316";
        ctx.fillRect(0, 0, W, 48);
        ctx.fillStyle = "#fff";
        ctx.font = "bold 20px Segoe UI";
        ctx.fillText(`⚠  WARNING: OVERCROWDING DETECTED (${overcrowdCount} PEOPLE)`, 30, 32);
      }

      ctx.fillStyle = "rgba(0,0,0,0.6)";
      ctx.fillRect(W - 165, H - 34, 160, 28);
      ctx.fillStyle = "#22c55e";
      ctx.font = "bold 11px monospace";
      ctx.fillText("● SIMULATION LIVE", W - 152, H - 16);

      ctx.fillStyle = "rgba(0,0,0,0.6)";
      ctx.fillRect(0, H - 34, 220, 28);
      ctx.fillStyle = "#94a3b8";
      ctx.font = "11px monospace";
      ctx.fillText(`${new Date().toLocaleTimeString()}  |  REC ●`, 10, H - 16);

      rafRef.current = requestAnimationFrame(draw);
    }

    rafRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  return (
    <canvas
      ref={canvasRef}
      width={W}
      height={H}
      style={{ width: "100%", height: "auto", display: "block" }}
    />
  );
}
