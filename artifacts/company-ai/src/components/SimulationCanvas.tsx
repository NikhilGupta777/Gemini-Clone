import { useEffect, useRef, RefObject, memo } from "react";
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

type SourceMode = "idle" | "video" | "webcam" | "stream";

interface RestrictedZone {
  id: string;
  name?: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

interface Props {
  tracks: Track[];
  anomalies: Anomaly[];
  cameraMode: "webcam" | "idle";
  videoRef: RefObject<HTMLVideoElement | null>;
  sourceMode?: SourceMode;
  frameJpeg?: string;
  restrictedZones?: RestrictedZone[];
}

function SimulationCanvas({
  tracks, anomalies, cameraMode, videoRef, sourceMode = "idle", frameJpeg, restrictedZones = [],
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);

  // Keep a decoded Image element for the latest JPEG frame from backend
  const backendImgRef = useRef<HTMLImageElement | null>(null);
  const lastJpegRef = useRef<string | undefined>(undefined);

  // When frameJpeg changes, update the Image element
  useEffect(() => {
    if (!frameJpeg || frameJpeg === lastJpegRef.current) return;
    lastJpegRef.current = frameJpeg;
    if (!backendImgRef.current) {
      backendImgRef.current = new Image();
    }
    backendImgRef.current.src = `data:image/jpeg;base64,${frameJpeg}`;
  }, [frameJpeg]);

  // Keep latest data in a ref so the RAF loop can read it without stale closures
  const dataRef = useRef({ tracks, anomalies, cameraMode, sourceMode, restrictedZones });
  useEffect(() => {
    dataRef.current = { tracks, anomalies, cameraMode, sourceMode, restrictedZones };
  }, [tracks, anomalies, cameraMode, sourceMode, restrictedZones]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let lastIdleFrameTs = 0;
    const IDLE_FRAME_INTERVAL = 100; // ~10 fps when idle

    function draw() {
      if (!ctx || !canvas) return;
      const { tracks, anomalies, cameraMode, sourceMode, restrictedZones } = dataRef.current;
      const t = Date.now();

      // Throttle to ~10 fps when idle — the standby animation only needs sin()
      if (sourceMode === "idle") {
        if (t - lastIdleFrameTs < IDLE_FRAME_INTERVAL) {
          rafRef.current = requestAnimationFrame(draw);
          return;
        }
        lastIdleFrameTs = t;
      }

      const anomalyIds = getAnomalyIds(anomalies);

      ctx.clearRect(0, 0, W, H);

      // ── Background ─────────────────────────────────────────────────────────

      const vid = videoRef.current;
      const hasLiveWebcam = cameraMode === "webcam" && vid && vid.readyState >= 2;
      const hasBackendFrame = backendImgRef.current?.complete && backendImgRef.current.naturalWidth > 0;
      const isActiveMode = sourceMode === "video" || sourceMode === "stream" || sourceMode === "webcam";

      if (hasLiveWebcam) {
        // Webcam: draw the local video element directly (zero latency)
        ctx.drawImage(vid, 0, 0, W, H);
        // Slight dark tint so overlays are readable
        ctx.fillStyle = "rgba(0,0,0,0.15)";
        ctx.fillRect(0, 0, W, H);
      } else if (isActiveMode && hasBackendFrame && backendImgRef.current) {
        // Video / Stream / Webcam (YOLO path): draw server-sent JPEG frame
        ctx.drawImage(backendImgRef.current, 0, 0, W, H);
        ctx.fillStyle = "rgba(0,0,0,0.18)";
        ctx.fillRect(0, 0, W, H);
      } else if (isActiveMode) {
        // Active but no frame yet — dark grid while waiting
        const bg = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, 700);
        bg.addColorStop(0, "#0a0f1f");
        bg.addColorStop(1, "#05080f");
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, W, H);
        ctx.strokeStyle = "rgba(168,85,247,0.06)";
        ctx.lineWidth = 1;
        for (let x = 80; x < W; x += 80) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
        for (let y = 80; y < H; y += 80) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
        // Waiting label
        ctx.font = "600 12px monospace";
        ctx.fillStyle = "#64748b";
        const wt = "Loading detection engine…";
        ctx.fillText(wt, W / 2 - ctx.measureText(wt).width / 2, H / 2);
      } else {
        // Idle — standby background
        const bg = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, 700);
        bg.addColorStop(0, "#080e1c");
        bg.addColorStop(1, "#040810");
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, W, H);
        ctx.strokeStyle = "rgba(59,130,246,0.04)";
        ctx.lineWidth = 1;
        for (let x = 80; x < W; x += 80) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
        for (let y = 80; y < H; y += 80) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }

        const pulse = 0.55 + 0.45 * Math.sin(t / 1200);
        ctx.globalAlpha = pulse;
        ctx.font = "700 13px monospace";
        ctx.fillStyle = "#1e3a5f";
        const msg = "SELECT A SOURCE — WEBCAM · UPLOAD · STREAM";
        ctx.fillText(msg, W / 2 - ctx.measureText(msg).width / 2, H / 2);
        ctx.font = "500 11px monospace";
        ctx.fillStyle = "#0f1f3d";
        const sub = "YOLO11m + SORT  ·  Real-time anomaly detection engine";
        ctx.fillText(sub, W / 2 - ctx.measureText(sub).width / 2, H / 2 + 22);
        ctx.globalAlpha = 1;
      }
      ctx.setLineDash([]);

      if (sourceMode !== "idle" && restrictedZones.length > 0) {
        const activeRestrictedIds = new Set(
          anomalies
            .filter((a) => a.type === "restricted_zone" && a.zone_id)
            .map((a) => a.zone_id as string)
        );

        for (const zone of restrictedZones) {
          const isActive = activeRestrictedIds.has(zone.id);
          ctx.setLineDash([6, 5]);
          ctx.lineWidth = isActive ? 2.5 : 1.6;
          ctx.strokeStyle = isActive ? "rgba(234,179,8,0.95)" : "rgba(234,179,8,0.45)";
          ctx.strokeRect(zone.x1, zone.y1, zone.x2 - zone.x1, zone.y2 - zone.y1);
          ctx.setLineDash([]);

          ctx.fillStyle = isActive ? "rgba(234,179,8,0.16)" : "rgba(234,179,8,0.08)";
          ctx.fillRect(zone.x1, zone.y1, zone.x2 - zone.x1, zone.y2 - zone.y1);

          const zoneLabel = zone.name ? `${zone.name} (${zone.id})` : zone.id;
          ctx.font = "700 10px monospace";
          const lw = ctx.measureText(zoneLabel).width;
          roundRect(ctx, zone.x1 + 6, Math.max(6, zone.y1 - 18), lw + 12, 14, 4);
          ctx.fillStyle = isActive ? "rgba(234,179,8,0.85)" : "rgba(234,179,8,0.6)";
          ctx.fill();
          ctx.fillStyle = "#05080f";
          ctx.fillText(zoneLabel, zone.x1 + 12, Math.max(16, zone.y1 - 8));
        }
      }

      // ── Detection tracks ────────────────────────────────────────────────────

      // Sort: anomalies/running first so their labels win collision checks
      const sorted = [...tracks].sort((a, b) => {
        const aScore = (anomalyIds.has(a.id) || a.running) ? 1 : 0;
        const bScore = (anomalyIds.has(b.id) || b.running) ? 1 : 0;
        return bScore - aScore;
      });

      // Track placed label regions to avoid overlapping text
      const placedLabels: { lx: number; ly: number; lw: number; lh: number }[] = [];

      const labelOverlaps = (lx: number, ly: number, lw: number, lh: number) => {
        const pad = 2;
        for (const p of placedLabels) {
          if (
            lx < p.lx + p.lw + pad &&
            lx + lw + pad > p.lx &&
            ly < p.ly + p.lh + pad &&
            ly + lh + pad > p.ly
          ) return true;
        }
        return false;
      };

      for (const track of sorted) {
        const { x1, y1, x2, y2, class_id, class_name, running, id, confidence } = track;
        const isAnomaly = anomalyIds.has(id);
        const isPerson = class_id === 0;
        const boxW = x2 - x1;
        const boxH = y2 - y1;

        let color: string;
        if (running) color = "#ef4444";
        else if (isAnomaly) color = "#f97316";
        else if (isPerson) color = "#3b82f6";
        else color = "#f59e0b";

        if (isAnomaly || running) { ctx.shadowBlur = 18; ctx.shadowColor = color; }
        drawCornerMarker(ctx, x1, y1, x2, y2, color);
        ctx.shadowBlur = 0;

        // Skip label for very small detections (tiny/far objects)
        const tooSmall = boxW < 38 && boxH < 38;
        if (!tooSmall) {
          const confStr = confidence !== undefined ? ` ${(confidence * 100).toFixed(0)}%` : "";
          const labelText = `#${id} ${class_name}${confStr}${running ? " ⚡" : ""}`;
          ctx.font = "600 10px monospace";
          const tw = ctx.measureText(labelText).width;
          const lh = 16;
          const lw = tw + 10;
          const lx = Math.min(x1, W - lw - 4);
          const ly = y1 > 22 ? y1 - 20 : y2 + 4;

          if (!labelOverlaps(lx - 4, ly - 1, lw, lh)) {
            placedLabels.push({ lx: lx - 4, ly: ly - 1, lw, lh });
            roundRect(ctx, lx - 4, ly - 1, lw, lh, 4);
            ctx.fillStyle = color + "cc";
            ctx.fill();
            ctx.fillStyle = "#fff";
            ctx.fillText(labelText, lx, ly + 11);
          }
        }

        if (running) {
          const cx = (x1 + x2) / 2;
          const cy = (y1 + y2) / 2;
          ctx.fillStyle = color + "40";
          ctx.globalAlpha = 0.5 + 0.5 * Math.abs(Math.sin(t / 200));
          ctx.beginPath(); ctx.arc(cx, cy, 22, 0, 2 * Math.PI); ctx.fill();
          ctx.globalAlpha = 1;
        }
      }

      // ── Anomaly zone overlays ───────────────────────────────────────────────

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
          ctx.beginPath(); ctx.arc(ax, ay, 50, 0, 2 * Math.PI); ctx.stroke();
          ctx.setLineDash([]);
        } else if (anomaly.type === "fight_suspected") {
          ctx.strokeStyle = `rgba(244,63,94,${0.45 + 0.3 * pulse})`;
          ctx.lineWidth = 3;
          ctx.setLineDash([10, 4]);
          ctx.beginPath(); ctx.arc(ax, ay, 56, 0, 2 * Math.PI); ctx.stroke();
          ctx.setLineDash([]);
          ctx.font = "700 10px monospace";
          ctx.fillStyle = "#f43f5e";
          const txt = "⚠ FIGHT SUSPECTED";
          ctx.fillText(txt, ax - ctx.measureText(txt).width / 2, ay - 64);
        } else if (anomaly.type === "fall_detected") {
          ctx.strokeStyle = `rgba(220,38,38,${0.45 + 0.3 * pulse})`;
          ctx.lineWidth = 2.5;
          ctx.setLineDash([8, 4]);
          ctx.beginPath(); ctx.arc(ax, ay, 42, 0, 2 * Math.PI); ctx.stroke();
          ctx.setLineDash([]);
          ctx.font = "700 10px monospace";
          ctx.fillStyle = "#dc2626";
          const txt = "⚠ FALL DETECTED";
          ctx.fillText(txt, ax - ctx.measureText(txt).width / 2, ay - 50);
        } else if (anomaly.type === "restricted_zone") {
          ctx.strokeStyle = `rgba(234,179,8,${0.45 + 0.3 * pulse})`;
          ctx.lineWidth = 2.5;
          ctx.setLineDash([6, 4]);
          ctx.beginPath(); ctx.arc(ax, ay, 38, 0, 2 * Math.PI); ctx.stroke();
          ctx.setLineDash([]);
          ctx.font = "700 10px monospace";
          ctx.fillStyle = "#eab308";
          const zoneText = anomaly.zone_name ?? anomaly.zone_id ?? "ZONE";
          const txt = `⚠ RESTRICTED ${zoneText}`;
          ctx.fillText(txt, ax - ctx.measureText(txt).width / 2, ay - 46);
        }
      }

      // ── HUD ────────────────────────────────────────────────────────────────

      const modeLabel = (() => {
        if (sourceMode === "video")  return "YOLO · VIDEO";
        if (sourceMode === "webcam") return "YOLO · WEBCAM";
        if (sourceMode === "stream") return "YOLO · STREAM";
        return "STANDBY";
      })();

      const modeColor = (() => {
        if (sourceMode === "video")  return "#a855f7";
        if (sourceMode === "webcam") return "#10b981";
        if (sourceMode === "stream") return "#f59e0b";
        return "#1e3a5f";
      })();

      ctx.fillStyle = "rgba(0,0,0,0.65)";
      roundRect(ctx, 12, H - 36, 230, 26, 6);
      ctx.fill();
      ctx.fillStyle = modeColor;
      ctx.font = "11px monospace";
      ctx.fillText(`${new Date().toLocaleTimeString()}  ·  ${modeLabel}`, 20, H - 17);

      const isReal = sourceMode !== "idle";
      const badgeText = isReal ? "⚡ LIVE DETECT" : "◉ STANDBY";
      const badgeW = 126;
      ctx.fillStyle = "rgba(0,0,0,0.65)";
      roundRect(ctx, W - badgeW - 12, H - 36, badgeW, 26, 6);
      ctx.fill();
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

export default memo(SimulationCanvas, (prev, next) => {
  if (prev.frameJpeg !== next.frameJpeg) return false;
  if (prev.sourceMode !== next.sourceMode) return false;
  if (prev.cameraMode !== next.cameraMode) return false;
  if (prev.videoRef !== next.videoRef) return false;
  if ((prev.restrictedZones?.length ?? 0) !== (next.restrictedZones?.length ?? 0)) return false;
  if ((prev.restrictedZones?.length ?? 0) > 0) {
    for (let i = 0; i < (prev.restrictedZones?.length ?? 0); i++) {
      const pz = prev.restrictedZones?.[i];
      const nz = next.restrictedZones?.[i];
      if (!pz || !nz) return false;
      if (
        pz.id !== nz.id
        || pz.x1 !== nz.x1
        || pz.y1 !== nz.y1
        || pz.x2 !== nz.x2
        || pz.y2 !== nz.y2
      ) return false;
    }
  }
  if (prev.tracks.length !== next.tracks.length) return false;
  if (prev.anomalies.length !== next.anomalies.length) return false;
  for (let i = 0; i < prev.tracks.length; i++) {
    const p = prev.tracks[i], n = next.tracks[i];
    if (p.id !== n.id || p.x1 !== n.x1 || p.y1 !== n.y1 || p.x2 !== n.x2 || p.y2 !== n.y2 || p.running !== n.running) return false;
  }
  for (let i = 0; i < prev.anomalies.length; i++) {
    const p = prev.anomalies[i], n = next.anomalies[i];
    if (p.type !== n.type || p.track_id !== n.track_id) return false;
  }
  return true;
});
