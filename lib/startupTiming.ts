import { AppState, Platform } from 'react-native';

import { TRACKING_EVENTS } from '@/constants/tracking-events';
import { track } from '@/lib/analytics';
import { takeStartupLoadDetails } from '@/lib/homeLoadTiming';
import mmkvStorage from '@/lib/mmvkStorage';
import {
  getQueryCacheRestoreInfo,
  getRestoredQueryCount,
  QueryCacheRestoreInfo,
} from '@/lib/queryPersistence';
import { getRunningUpdateId, perfNow } from '@/lib/telemetry/perfClock';
import { reportPerfSample } from '@/lib/telemetry/perfReporter';
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

const now = perfNow;

// The first moment this JS runtime ran, on the same clock as every mark. React Native's
// native start times are on another clock on iOS (spans across them came out as days),
// so the launch is also measured from here.
const jsStartAt = now();
// `background` (or `unknown`) here means iOS pre-warmed the app or a push woke it: the
// user arrives later, at the first `active`.
const initialAppState = Platform.OS === 'web' ? 'active' : AppState.currentState;
let firstActiveAt: number | undefined = initialAppState === 'active' ? jsStartAt : undefined;

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
        if (status === 'active') firstActiveAt ??= now();
        if (status !== 'active' && !marks.homeContentReady) backgroundedDuringStartup = true;
      });

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

/** No launch takes ten minutes: a span longer than that crossed two clocks. */
const MAX_PLAUSIBLE_SPAN_MS = 10 * 60 * 1000;
const plausible = (value: number | undefined) =>
  value === undefined || (value >= 0 && value <= MAX_PLAUSIBLE_SPAN_MS) ? value : undefined;
const implausible = (value: number | undefined) =>
  value !== undefined && plausible(value) === undefined;

type StartupLoadDetails = ReturnType<typeof takeStartupLoadDetails>;

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
  jsStart,
  firstActive,
  startedInBackground,
  cacheInfo,
  load,
  updateId,
}: {
  marks: Partial<Record<StartupPhase, number>>;
  native: NativeStartupTiming | null;
  queries: ResolvedQuery[];
  launchKind: 'cold' | 'ota_reload' | 'page_load' | 'after_login';
  backgrounded: boolean;
  jsHeapMb?: number;
  restoredQueries?: number;
  isWeb: boolean;
  /** When this JS runtime started, on the marks' clock. */
  jsStart?: number;
  /** When the app was first in the foreground, on the marks' clock. */
  firstActive?: number;
  startedInBackground?: boolean;
  cacheInfo?: QueryCacheRestoreInfo;
  load?: StartupLoadDetails;
  updateId?: string;
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
  // `performance.now()` can count from device boot, so compare against this
  // runtime's own start (on the same clock) rather than 0.
  const runtimeStart = isWeb ? 0 : (jsStart ?? bundleStart ?? appStart ?? 0);
  const beforeReady =
    ready === undefined
      ? []
      : queries.filter(q => q.resolvedAt >= runtimeStart && q.resolvedAt <= ready);
  const gating = beforeReady.reduce<ResolvedQuery | undefined>(
    (latest, query) => (!latest || query.resolvedAt > latest.resolvedAt ? query : latest),
    undefined,
  );

  // Spans that read React Native's native start times cross clocks on iOS; anything
  // implausible is left out and flagged rather than reported as a days-long launch.
  const nativeStartup = span(native?.startTime, bundleStart);
  const jsToFirstLayout = span(bundleStart, phaseMarks.firstLayout);
  const total = span(appStart, ready);
  const gatingMs = span(appStart, gating?.resolvedAt);
  const nativeTimingInvalid =
    !isWeb && [nativeStartup, jsToFirstLayout, total, gatingMs].some(implausible);
  // The wait the user saw: from when the app was first in front (a pre-warmed or
  // push-woken launch runs long before that) until balances. 0 when they were ready first.
  const visibleToReady =
    firstActive === undefined || ready === undefined
      ? undefined
      : ready <= firstActive
        ? 0
        : span(firstActive, ready);

  return {
    launch_kind: launchKind,
    backgrounded_during_startup: backgrounded,
    started_in_background: startedInBackground,
    // Process start → JS starts running. Includes OS and native-module setup.
    native_startup_ms: plausible(nativeStartup),
    // JS starts → first layout of the root view. Module evaluation plus the first render.
    js_to_first_layout_ms: plausible(jsToFirstLayout),
    first_layout_to_splash_hidden_ms: span(phaseMarks.firstLayout, phaseMarks.splashHidden),
    // Splash gone → balances on screen: the skeleton the user stares at.
    splash_to_home_ready_ms: span(phaseMarks.splashHidden, ready),
    home_mounted_after_splash_ms: span(phaseMarks.splashHidden, phaseMarks.homeMounted),
    total_to_home_ready_ms: plausible(total),
    // Same clock end to end, so always trustworthy: this JS runtime's start → balances.
    js_to_home_ready_ms: isWeb ? undefined : plausible(span(jsStart, ready)),
    visible_to_home_ready_ms: visibleToReady,
    native_timing_invalid: nativeTimingInvalid || undefined,
    gating_query: gating?.key,
    gating_query_ms: plausible(gatingMs),
    gating_query_after_splash_ms: span(phaseMarks.splashHidden, gating?.resolvedAt),
    gating_query_failed: gating?.isError,
    queries_settled: beforeReady.length,
    queries_failed: beforeReady.filter(q => q.isError).length,
    // Queries put back from the persisted cache before the first render. Above 0,
    // home drew the last known balances instead of skeletons.
    cache_restored_queries: restoredQueries,
    // Why the cache was (or wasn't) restored: a launch with nothing restored is a slow one.
    cache_outcome: cacheInfo?.outcome,
    cache_dropped_families: cacheInfo?.droppedFamilies.length
      ? cacheInfo.droppedFamilies.join(',')
      : undefined,
    cache_dropped_expired: cacheInfo?.droppedExpired || undefined,
    cache_newest_age_ms: cacheInfo?.newestAgeMs,
    // What the user looked at while balances loaded: last-known figures or skeletons.
    snapshot_shown: load?.snapshotShown,
    skeleton_shown: load?.skeletonShown,
    snapshot_age_ms: load?.snapshotAgeMs,
    // Which part of the home gate cleared last, and when each did (ms after the splash).
    slowest_gate: load?.slowestGate,
    gate_waits: load ? Object.fromEntries(load.gateWaits.map(w => [w.gate, w.ms])) : undefined,
    slow_queries: load?.slowQueries.length
      ? load.slowQueries.map(q => `${q.key}:${q.ms}`).join(',')
      : undefined,
    auth_refresh_ms: load?.authRefreshMs,
    token_fetch_ms: load?.tokenFetch?.totalMs,
    token_reads_ms: load?.tokenFetch?.readsMs,
    token_pricing_ms: load?.tokenFetch?.pricingMs,
    token_slowest_chain: load?.tokenFetch?.slowestChain,
    token_failed_chains: load?.tokenFetch?.failedChains?.length
      ? load.tokenFetch.failedChains.join(',')
      : undefined,
    update_id: updateId,
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

  const load = takeStartupLoadDetails(marks.splashHidden);
  const cacheInfo = getQueryCacheRestoreInfo();
  const payload = buildStartupTimingPayload({
    marks,
    native: Platform.OS === 'web' ? null : readNativeStartupTiming(),
    queries: collectResolvedQueries(queryClient, Date.now(), now()),
    launchKind,
    backgrounded: backgroundedDuringStartup,
    jsHeapMb: readJsHeapMb(),
    restoredQueries: getRestoredQueryCount(),
    isWeb: Platform.OS === 'web',
    jsStart: jsStartAt,
    firstActive: firstActiveAt,
    startedInBackground: initialAppState !== 'active',
    cacheInfo,
    load,
    updateId: getRunningUpdateId(),
  });
  track(TRACKING_EVENTS.APP_STARTUP_TIMING, payload);

  // The same launch, for the admin portal's per-user view (lib/telemetry/perfReporter).
  reportPerfSample({
    kind: 'startup',
    sampleRate: 1,
    launchKind,
    homeReadyMs: payload.splash_to_home_ready_ms,
    visibleToReadyMs: payload.visible_to_home_ready_ms,
    jsToReadyMs: payload.js_to_home_ready_ms,
    authRefreshMs: load.authRefreshMs,
    skeletonShown: load.skeletonShown,
    snapshotShown: load.snapshotShown,
    snapshotAgeMs: load.snapshotAgeMs,
    backgrounded: backgroundedDuringStartup,
    cacheRestored: getRestoredQueryCount(),
    cacheOutcome: cacheInfo.outcome,
    slowestGate: load.slowestGate,
    gateWaits: load.gateWaits,
    slowQueries: load.slowQueries,
    tokenFetch: load.tokenFetch,
    jsHeapMb: payload.js_heap_mb,
  });
};
