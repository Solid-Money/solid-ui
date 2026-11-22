import { Platform } from 'react-native';

/**
 * One monotonic clock for every app-performance mark (startup phases, home load
 * gates, resume timing, slow queries), so spans between them never mix clocks.
 * React Native's `performance.rnStartupTiming` is on a different base on iOS
 * (spans across it came out as days), which is why nothing here reads it.
 */
export const perfNow = (): number =>
  typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? performance.now()
    : Date.now();

/** A duration in whole ms, or undefined when it can't be one (negative, NaN, absurd). */
export const spanMs = (
  from: number | null | undefined,
  to: number | null | undefined,
  max = 60 * 60 * 1000,
): number | undefined => {
  if (from == null || to == null) return undefined;
  const value = Math.round(to - from);
  return Number.isFinite(value) && value >= 0 && value <= max ? value : undefined;
};

/**
 * The OTA bundle the app is running (expo-updates' update id), or undefined for
 * the bundle built into the binary and on web. Read lazily: expo-updates is a
 * native module, and nothing here may load it on web.
 */
export const getRunningUpdateId = (): string | undefined => {
  if (Platform.OS === 'web') return undefined;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Updates = require('expo-updates') as { updateId?: string | null };
    return Updates.updateId ?? undefined;
  } catch {
    return undefined;
  }
};
