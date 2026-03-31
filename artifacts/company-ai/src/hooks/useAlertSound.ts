import { useEffect, useRef } from "react";
import { Anomaly } from "./useSimulation";

function playTone(
  ctx: AudioContext,
  freq: number,
  duration: number,
  vol: number,
  delayMs = 0
) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.type = "square";
  osc.frequency.value = freq;
  const start = ctx.currentTime + delayMs / 1000;
  gain.gain.setValueAtTime(vol, start);
  gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
  osc.start(start);
  osc.stop(start + duration + 0.05);
}

const COOLDOWN_MS = 2000;

export function useAlertSound(anomalies: Anomaly[], enabled = true) {
  const ctxRef = useRef<AudioContext | null>(null);
  const lastTypeSetRef = useRef<Set<string>>(new Set());
  const lastPlayedRef = useRef<Record<string, number>>({});

  useEffect(() => {
    if (!enabled) return;

    const currentTypes = new Set(anomalies.map((a) => a.type));
    const now = Date.now();

    for (const type of currentTypes) {
      const alreadyActive = lastTypeSetRef.current.has(type);
      const lastPlayed = lastPlayedRef.current[type] ?? 0;
      const cooledDown = now - lastPlayed > COOLDOWN_MS;

      if (!alreadyActive && cooledDown) {
        if (!ctxRef.current) {
          ctxRef.current = new (window.AudioContext ||
            (window as any).webkitAudioContext)();
        }
        const ctx = ctxRef.current;

        if (type === "running") {
          // Two sharp high beeps — matches original winsound.Beep(1000, 200)
          playTone(ctx, 1000, 0.2, 0.25, 0);
          playTone(ctx, 1200, 0.15, 0.2, 260);
        } else if (type === "unattended_object") {
          // Single medium beep
          playTone(ctx, 800, 0.3, 0.25, 0);
        } else if (type === "overcrowding") {
          // Lower warning tone
          playTone(ctx, 600, 0.4, 0.15, 0);
        }

        lastPlayedRef.current[type] = now;
      }
    }

    lastTypeSetRef.current = currentTypes;
  }, [anomalies, enabled]);
}
