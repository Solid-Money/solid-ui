import { AppState, Platform } from 'react-native';

import { TRACKING_EVENTS } from '@/constants/tracking-events';
import { track } from '@/lib/analytics';
import mmkvStorage from '@/lib/mmvkStorage';
import { getRestoredQueryCount } from '@/lib/queryPersistence';
import { useUserStore } from '@/store/useUserStore';

import type { QueryClient } from '@tanstack/react-query';

/**
 * Times one launch, from the process starting to the home screen showing real
 * balances, and reports it once as `app_startup_timing`.
 *
 * EAS Observe's time-to-interactive is marked when the splash hides, which is
 * before any balance has loaded: a launch that sits on skeletons for ten
 * seconds still reads as fast there. This measures the point the user is
 * waiting for, and splits it into the phases that can each be slow:
 *
 *   process start → JS bundle starts → first layout → splash hidden → home content ready
 *
 * It also names the query that resolved last before home was ready, which is
 * the one that kept the skeleton up.
 */

export type StartupPhase = 'firstLayout' | 'splashHidden' | 'homeMounted' | 'homeContentReady';

/** What React Native reports about the native half of startup (null on web or when unknown). */
export type NativeStartupTiming = {
  startTime?: number | null;
  initializeRuntimeStart?: number | null;
  executeJavaScriptBundleEntryPointStart?: number | null;
};

export type ResolvedQuery = { key: string; resolvedAt: number; isError: boolean };

const marks: Partial<Record<StartupPhase, number>> = {};

// Whether someone was already signed in when the app started. If not, home is
// reached through sign-in, and the time spent there is not launch time.
const signedInAtLaunch = useUserStore.getState().users.some(user => user.selected);
let reported = false;
let backgroundedDuringStartup = false;

// A launch that went to the background before home was ready measures how long
// the user was away, not how slow the app was. Flag it so it can be filtered.
const appStateSubscription =
  Platform.OS === 'web'
    ? null
    : AppState.addEventListener('change', status => {
        if (status !== 'active' && !marks.homeContentReady) backgroundedDuringStartup = true;
      });

const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

export const markStartup = (phase: StartupPhase) => {
  if (marks[phase] === undefined) marks[phase] = now();
};

const storage = Platform.OS === 'web' ? null : mmkvStorage('startup-timing');
const OTA_RELOAD_KEY = 'otaReloadRequestedAt';

/** Call right before `Updates.reloadAsync()` so the next launch is reported as an OTA reload. */
export const markOtaReloadRequested = () => {
  try {
    storage?.setItem(OTA_RELOAD_KEY, String(Date.now()));
  } catch {
    // Best-effort: a lost flag only mislabels one launch.
  }
};

const consumeOtaReloadFlag = (): boolean => {
  try {
    const requestedAt = Number(storage?.getItem(OTA_RELOAD_KEY));
    storage?.removeItem(OTA_RELOAD_KEY);
    // A reload lands within seconds; an old flag is from a reload that failed.
    return Number.isFinite(requestedAt) && Date.now() - requestedAt < 60_000;
  } catch {
    return false;
  }
};

const readNativeStartupTiming = (): NativeStartupTiming | null => {
  try {
    return (
      (performance as unknown as { rnStartupTiming?: NativeStartupTiming }).rnStartupTiming ?? null
    );
  } catch {
    return null;
  }
};

const readJsHeapMb = (): number | undefined => {
  try {
    const used = (performance as unknown as { memory?: { usedJSHeapSize?: number } }).memory
      ?.usedJSHeapSize;
    return used ? Math.round(used / 1024 / 1024) : undefined;
  } catch {
    return undefined;
  }
};

/**
 * Every query that settled before home was ready, on the same clock as the marks.
 * React Query stamps `dataUpdatedAt` with `Date.now()`, so shift it onto the
 * `performance.now()` timeline the marks use.
 */
export const collectResolvedQueries = (
  queryClient: QueryClient,
  wallClockNow: number,
  perfNow: number,
): ResolvedQuery[] => {
  const offset = wallClockNow - perfNow;
  return queryClient
    .getQueryCache()
    .getAll()
    .flatMap(query => {
      const { dataUpdatedAt, errorUpdatedAt, status } = query.state;
      const settledAt = Math.max(dataUpdatedAt, errorUpdatedAt);
      if (!settledAt) return [];
      return [
        {
          key: String(query.queryKey[0]),
          resolvedAt: settledAt - offset,
          isError: status === 'error',
        },
      ];
    });
};

const round = (value: number | undefined) =>
  value === undefined || !Number.isFinite(value) ? undefined : Math.round(value);

const span = (from: number | null | undefined, to: number | null | undefined) =>
  from == null || to == null ? undefined : round(to - from);

/** The `app_startup_timing` properties. Pure, so the arithmetic can be tested. */
export const buildStartupTimingPayload = ({
  marks: phaseMarks,
  native,
  queries,
  launchKind,
  backgrounded,
  jsHeapMb,
  restoredQueries = 0,
  isWeb,
}: {
  marks: Partial<Record<StartupPhase, number>>;
  native: NativeStartupTiming | null;
  queries: ResolvedQuery[];
  launchKind: 'cold' | 'ota_reload' | 'page_load' | 'after_login';
  backgrounded: boolean;
  jsHeapMb?: number;
  restoredQueries?: number;
  isWeb: boolean;
}) => {
  const ready = phaseMarks.homeContentReady;
  const bundleStart = native?.executeJavaScriptBundleEntryPointStart;
  // On web `performance.now()` already counts from navigation start, so 0 is the
  // origin. On native it's the process start when the platform reports one; iOS
  // can pre-warm a process long before the tap, so `js_to_first_layout_ms` and
  // the phases after it are the figures that never include time the user didn't wait.
  const appStart = isWeb ? 0 : (native?.startTime ?? bundleStart ?? undefined);

  // Only what settled in this runtime: data restored from the persisted cache
  // carries the time it was first fetched, before this launch began. Native
  // `performance.now()` can count from device boot, so compare against the
  // bundle start rather than 0.
  const runtimeStart = isWeb ? 0 : (bundleStart ?? appStart ?? 0);
  const beforeReady =
    ready === undefined
      ? []
      : queries.filter(q => q.resolvedAt >= runtimeStart && q.resolvedAt <= ready);
  const gating = beforeReady.reduce<ResolvedQuery | undefined>(
    (latest, query) => (!latest || query.resolvedAt > latest.resolvedAt ? query : latest),
    undefined,
  );

  return {
    launch_kind: launchKind,
    backgrounded_during_startup: backgrounded,
    // Process start → JS starts running. Includes OS and native-module setup.
    native_startup_ms: span(native?.startTime, bundleStart),
    // JS starts → first layout of the root view. Module evaluation plus the first render.
    js_to_first_layout_ms: span(bundleStart, phaseMarks.firstLayout),
    first_layout_to_splash_hidden_ms: span(phaseMarks.firstLayout, phaseMarks.splashHidden),
    // Splash gone → balances on screen: the skeleton the user stares at.
    splash_to_home_ready_ms: span(phaseMarks.splashHidden, ready),
    home_mounted_after_splash_ms: span(phaseMarks.splashHidden, phaseMarks.homeMounted),
    total_to_home_ready_ms: span(appStart, ready),
    gating_query: gating?.key,
    gating_query_ms: span(appStart, gating?.resolvedAt),
    gating_query_failed: gating?.isError,
    queries_settled: beforeReady.length,
    queries_failed: beforeReady.filter(q => q.isError).length,
    // Queries put back from the persisted cache before the first render. Above 0,
    // home drew the last known balances instead of skeletons.
    cache_restored_queries: restoredQueries,
    js_heap_mb: jsHeapMb,
  };
};

/**
 * Marks home as showing real content and, the first time in this JS runtime,
 * reports the launch. Later calls (pull-to-refresh, returning to home) do nothing.
 */
export const reportHomeContentReady = (queryClient: QueryClient) => {
  markStartup('homeContentReady');
  if (reported) return;
  reported = true;
  appStateSubscription?.remove();

  const reloadedIntoUpdate = Platform.OS !== 'web' && consumeOtaReloadFlag();
  const launchKind = !signedInAtLaunch
    ? 'after_login'
    : Platform.OS === 'web'
      ? 'page_load'
      : reloadedIntoUpdate
        ? 'ota_reload'
        : 'cold';

  track(
    TRACKING_EVENTS.APP_STARTUP_TIMING,
    buildStartupTimingPayload({
      marks,
      native: Platform.OS === 'web' ? null : readNativeStartupTiming(),
      queries: collectResolvedQueries(queryClient, Date.now(), now()),
      launchKind,
      backgrounded: backgroundedDuringStartup,
      jsHeapMb: readJsHeapMb(),
      restoredQueries: getRestoredQueryCount(),
      isWeb: Platform.OS === 'web',
    }),
  );
};
