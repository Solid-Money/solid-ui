import { EXPO_PUBLIC_ENVIRONMENT } from '@/lib/config';

import type { ComponentType } from 'react';

type ObserveModule = typeof import('expo-observe');

// expo-observe (and its expo-app-metrics dependency) resolve their native
// modules at import time and throw when the binary doesn't include them, e.g.
// an OTA update reaching a build created before expo-observe was added
// (runtimeVersion policy is appVersion). Metrics are best-effort, so fall back
// to no-ops instead of crashing the app at startup.
let observe: ObserveModule | undefined;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  observe = require('expo-observe');
} catch {
  observe = undefined;
}

/**
 * Configures EAS Observe metric dispatching. Call once at app startup, before
 * the first metrics are collected.
 *
 * Debug builds collect but never dispatch metrics by default; pass
 * `dispatchInDebug: true` here to test the pipeline locally.
 */
export function configureObserve() {
  observe?.default.configure({
    environment: EXPO_PUBLIC_ENVIRONMENT || 'development',
  });
}

/**
 * Records the time-to-interactive startup metric. Call once the splash screen
 * is hidden and the first real UI is visible.
 */
export function markAppInteractive() {
  observe?.AppMetrics.markInteractive();
}

/**
 * Wraps the root layout with `AppMetricsRoot`, which records the
 * time-to-first-render startup metric (the SDK 55 equivalent of SDK 56's
 * `ObserveRoot`).
 */
export function withObserve<P extends Record<string, unknown>>(
  Component: ComponentType<P>,
): ComponentType<P> {
  return observe ? observe.AppMetricsRoot.wrap(Component) : Component;
}
