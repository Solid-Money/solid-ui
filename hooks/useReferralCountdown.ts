import { useEffect, useMemo, useState } from 'react';

const SECOND_MS = 1000;
const MINUTE_MS = 60 * SECOND_MS;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

export interface ReferralCountdown {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  /** Milliseconds left, floored at 0. */
  remainingMs: number;
  /** The target moment has passed. */
  isElapsed: boolean;
  /** Short label, e.g. "12d 4h", "4h 09m", "09:12". */
  label: string;
}

/**
 * Ticks down to `target`.
 *
 * The tick rate follows the magnitude: once a minute while more than an hour
 * out, once a second inside the final hour. A reward that unlocks in twelve
 * days does not need a per-second re-render, but the last minute should feel
 * live.
 */
export function useReferralCountdown(target?: string | Date | null): ReferralCountdown | null {
  const targetMs = useMemo(() => {
    if (!target) return null;
    const parsed = target instanceof Date ? target.getTime() : Date.parse(target);
    return Number.isFinite(parsed) ? parsed : null;
  }, [target]);

  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (targetMs === null) return;

    let timer: ReturnType<typeof setTimeout>;

    // Self-scheduling so the cadence re-derives on every tick: once a minute
    // while more than an hour out, once a second inside the final hour, and
    // stopping entirely once the target passes. A reward twelve days out does
    // not need per-second re-renders, but the last minute should feel live.
    const schedule = () => {
      const remaining = targetMs - Date.now();
      if (remaining <= 0) {
        setNow(Date.now());
        return;
      }
      const interval = remaining > HOUR_MS ? MINUTE_MS : SECOND_MS;
      timer = setTimeout(
        () => {
          setNow(Date.now());
          schedule();
        },
        Math.min(interval, remaining),
      );
    };

    schedule();
    return () => clearTimeout(timer);
  }, [targetMs]);

  return useMemo(() => {
    if (targetMs === null) return null;

    const remainingMs = Math.max(0, targetMs - now);
    const days = Math.floor(remainingMs / DAY_MS);
    const hours = Math.floor((remainingMs % DAY_MS) / HOUR_MS);
    const minutes = Math.floor((remainingMs % HOUR_MS) / MINUTE_MS);
    const seconds = Math.floor((remainingMs % MINUTE_MS) / SECOND_MS);

    const pad = (value: number) => value.toString().padStart(2, '0');
    const label =
      days > 0
        ? `${days}d ${hours}h`
        : hours > 0
          ? `${hours}h ${pad(minutes)}m`
          : `${pad(minutes)}:${pad(seconds)}`;

    return {
      days,
      hours,
      minutes,
      seconds,
      remainingMs,
      isElapsed: remainingMs <= 0,
      label,
    };
  }, [targetMs, now]);
}
