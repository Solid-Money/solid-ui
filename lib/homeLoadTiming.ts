import { AppState, AppStateStatus } from 'react-native';

import { TRACKING_EVENTS } from '@/constants/tracking-events';
import { track } from '@/lib/analytics';
import { getAuthRefreshSince } from '@/lib/telemetry/authTiming';
import { watchNetworkType } from '@/lib/telemetry/networkType';
import { perfNow, spanMs } from '@/lib/telemetry/perfClock';
import { reportPerfSample } from '@/lib/telemetry/perfReporter';
import {
  getTokenFetchTimingSince,
  onTokenFetchTiming,
  TokenFetchTiming,
} from '@/lib/telemetry/tokenFetchTiming';

import type { QueryCacheNotifyEvent, QueryClient } from '@tanstack/react-query';

/**
 * Times how long the home screen waits to show balances, and what it waits on,
 * for launches (reported by lib/startupTiming) and for returns to the app,
 * reported here as `app_resume_timing`.
 *
 * Launch timing alone missed the case users hit most: tapping a push or coming
 * back after a few hours to an app that was still running, then watching
 * skeletons. A return is measured from the moment the app is in front again
 * until (a) the balances are on screen (`homeReadyMs`, 0 when they never left)
 * and (b) every balance query the return refetched has settled (`freshMs`).
 *
 * Also reports any balance query that takes longer than {@link SLOW_QUERY_MS}
 * (`slow_query`), whatever the app was doing, so a slow source shows up by name
 * instead of as "home was slow".
 */

/** The parts of the home loading gate (components/Home/NewHome/HomeScreenNew). */
export type HomeGate = 'tokens' | 'vaultBalance' | 'savings' | 'card' | 'portfolio';
export const HOME_GATES: readonly HomeGate[] = [
  'tokens',
  'vaultBalance',
  'savings',
  'card',
  'portfolio',
];
export type HomeGateState = Record<HomeGate, boolean>;

/** The query families the gate waits on, by the first element of their key. */
export const GATE_QUERY_FAMILIES: ReadonlySet<string> = new Set([
  'tokenBalances',
  'vault',
  'vaultExchangeRate',
  'fusePriceUsd',
  'ethPriceUsd',
  'btcPriceUsd',
  'tierMembership',
  'portfolioCustody',
  'cardStatus',
  'cardDetails',
  'cardBalance',
]);

export const SLOW_QUERY_MS = 5_000;
/** Shorter trips away aren't a "return": nothing on screen has gone stale. */
export const RESUME_MIN_BACKGROUND_MS = 30_000;
/** A return still loading after this is reported as timed out. */
export const RESUME_TIMEOUT_MS = 60_000;
/** Refetches that start this soon after the return belong to it; later ones are polls. */
const RESUME_COLLECT_MS = 1_500;
/** Returns where nothing was slow are sampled; slow ones are always reported. */
export const FAST_RESUME_SAMPLE_RATE = 0.1;
/** A return whose refetches take longer than this counts as slow even with figures on screen. */
const SLOW_FRESH_MS = 3_000;
const MAX_SLOW_QUERY_EVENTS = 15;
/** A wallet balance read slower than this is reported on its own, with its breakdown. */
export const SLOW_TOKEN_FETCH_MS = 8_000;
const MAX_SLOW_TOKEN_FETCH_EVENTS = 5;
const SLOW_QUERY_EVENT_GAP_MS = 60_000;
const MAX_REMEMBERED_SLOW_QUERIES = 50;

type SlowQuery = { key: string; ms: number; failed: boolean; endedAt: number; hadData: boolean };

type Episode = {
  kind: 'startup' | 'resume';
  startedAt: number;
  backgroundMs?: number;
  homeMounted: boolean;
  everLoading: boolean;
  readyAt?: number;
  clearedAt: Partial<Record<HomeGate, number>>;
  skeletonShown: boolean;
  snapshotShown: boolean;
  snapshotAgeMs?: number;
  /** Resume only: refetches the return started, still running. */
  collecting: boolean;
  pending: Set<string>;
  lastPendingEndAt?: number;
  freshAt?: number;
  timeout?: ReturnType<typeof setTimeout>;
  done: boolean;
};

const newEpisode = (kind: Episode['kind'], startedAt: number): Episode => ({
  kind,
  startedAt,
  homeMounted: false,
  everLoading: false,
  clearedAt: {},
  skeletonShown: false,
  snapshotShown: false,
  collecting: false,
  pending: new Set(),
  done: false,
});

let gates: Partial<HomeGateState> = {};
let homeMounted = false;
/** When the last-known figures on screen were saved; undefined when skeletons are shown. */
let lastKnownSavedAt: number | undefined;
const startup = newEpisode('startup', perfNow());
let startupDone = false;
let resume: Episode | null = null;
let installed = false;
// Wall clock: the monotonic clock may not run while the device sleeps.
let backgroundSince: number | null = AppState.currentState === 'active' ? null : Date.now();
let everActive = AppState.currentState === 'active';

const inFlight = new Map<string, { family: string; startedAt: number; hadData: boolean }>();
const slowQueries: SlowQuery[] = [];
let slowQueryEvents = 0;
let slowTokenFetchEvents = 0;
const lastSlowEventAt = new Map<string, number>();

const anyLoading = (state: Partial<HomeGateState>) => HOME_GATES.some(gate => state[gate]);

const activeEpisodes = (): Episode[] =>
  [startupDone ? null : startup, resume && !resume.done ? resume : null].filter(
    (episode): episode is Episode => !!episode,
  );

const applyGates = (
  episode: Episode,
  next: Partial<HomeGateState>,
  savedAt: number | undefined,
  at: number,
) => {
  episode.homeMounted = true;
  if (anyLoading(next)) {
    episode.everLoading = true;
    episode.readyAt = undefined;
    if (savedAt !== undefined) {
      episode.snapshotShown = true;
      episode.snapshotAgeMs ??= Math.max(0, Date.now() - savedAt);
    } else {
      episode.skeletonShown = true;
    }
  } else if (episode.everLoading && episode.readyAt === undefined) {
    episode.readyAt = at;
  }
  for (const gate of HOME_GATES) {
    if (gates[gate] && !next[gate]) episode.clearedAt[gate] = at;
  }
};

/** Gate waits measured from `origin`, slowest first. */
const gateWaits = (episode: Episode, origin: number) =>
  HOME_GATES.flatMap(gate => {
    const cleared = episode.clearedAt[gate];
    return cleared === undefined ? [] : [{ gate, ms: Math.max(0, Math.round(cleared - origin)) }];
  }).sort((a, b) => b.ms - a.ms);

const slowQueriesSince = (since: number) =>
  slowQueries
    .filter(query => query.endedAt >= since)
    .sort((a, b) => b.ms - a.ms)
    .slice(0, 5)
    .map(({ key, ms, failed }) => ({ key, ms, failed }));

const tokenFetchFields = (timing: TokenFetchTiming | null) =>
  timing
    ? {
        totalMs: timing.totalMs,
        readsMs: timing.readsMs,
        pricingMs: timing.pricingMs,
        tokenCount: timing.tokenCount,
        unpricedCount: timing.unpricedCount,
        timedOutReads: timing.timedOutReads,
        failedChains: timing.failedChains,
        slowestChain: timing.slowestChain,
        slowestChainMs: timing.slowestChainMs,
      }
    : undefined;

/** Called by the home screen whenever a part of its loading gate starts or stops loading. */
export const noteHomeGates = (next: HomeGateState, savedAt?: number): void => {
  const at = perfNow();
  for (const episode of activeEpisodes()) applyGates(episode, next, savedAt, at);
  gates = { ...next };
  lastKnownSavedAt = savedAt;
  homeMounted = true;
  if (resume) maybeFinishResume(resume);
};

/** Called when the home screen unmounts: its gate says nothing until it mounts again. */
export const noteHomeUnmounted = (): void => {
  homeMounted = false;
  gates = {};
  lastKnownSavedAt = undefined;
};

/**
 * What the launch waited on, for the startup report. Measured from `origin`
 * (when the splash hid; the launch's start when it never did). Ends the launch
 * episode: from here on only returns to the app are timed.
 */
export const takeStartupLoadDetails = (origin?: number) => {
  startupDone = true;
  const waits = gateWaits(startup, origin ?? startup.startedAt);
  return {
    skeletonShown: startup.skeletonShown,
    snapshotShown: startup.snapshotShown,
    snapshotAgeMs: startup.snapshotAgeMs,
    gateWaits: waits,
    slowestGate: waits[0]?.gate,
    slowQueries: slowQueriesSince(startup.startedAt),
    tokenFetch: tokenFetchFields(getTokenFetchTimingSince(startup.startedAt)),
    authRefreshMs: getAuthRefreshSince(startup.startedAt)?.ms,
    startedAt: startup.startedAt,
  };
};

const recordSlowQuery = (query: SlowQuery) => {
  slowQueries.push(query);
  if (slowQueries.length > MAX_REMEMBERED_SLOW_QUERIES) slowQueries.shift();
  const lastAt = lastSlowEventAt.get(query.key);
  if (slowQueryEvents >= MAX_SLOW_QUERY_EVENTS) return;
  if (lastAt !== undefined && query.endedAt - lastAt < SLOW_QUERY_EVENT_GAP_MS) return;
  slowQueryEvents += 1;
  lastSlowEventAt.set(query.key, query.endedAt);
  track(TRACKING_EVENTS.SLOW_QUERY, {
    query: query.key,
    duration_ms: query.ms,
    failed: query.failed,
    // With data on screen a slow refetch costs nothing visible; without it, it's a skeleton.
    had_data: query.hadData,
    phase: !startupDone ? 'startup' : resume && !resume.done ? 'resume' : 'steady',
  });
};

const onTokenFetch = (timing: TokenFetchTiming) => {
  if (timing.totalMs < SLOW_TOKEN_FETCH_MS || slowTokenFetchEvents >= MAX_SLOW_TOKEN_FETCH_EVENTS) {
    return;
  }
  slowTokenFetchEvents += 1;
  track(TRACKING_EVENTS.TOKEN_BALANCES_SLOW, {
    total_ms: timing.totalMs,
    reads_ms: timing.readsMs,
    pricing_ms: timing.pricingMs,
    token_count: timing.tokenCount,
    unpriced_count: timing.unpricedCount,
    timed_out_reads: timing.timedOutReads,
    failed_chains: timing.failedChains.join(','),
    slowest_chain: timing.slowestChain,
    slowest_chain_ms: timing.slowestChainMs,
    phase: !startupDone ? 'startup' : resume && !resume.done ? 'resume' : 'steady',
  });
};

const onFetchStart = (hash: string, family: string, hadData: boolean) => {
  inFlight.set(hash, { family, startedAt: perfNow(), hadData });
  if (resume && !resume.done && resume.collecting) resume.pending.add(hash);
};

const onFetchEnd = (hash: string, outcome: 'success' | 'error' | 'cancelled') => {
  const started = inFlight.get(hash);
  if (!started) return;
  inFlight.delete(hash);
  const at = perfNow();
  const ms = Math.round(at - started.startedAt);
  if (outcome !== 'cancelled' && ms >= SLOW_QUERY_MS) {
    recordSlowQuery({
      key: started.family,
      ms,
      failed: outcome === 'error',
      endedAt: at,
      hadData: started.hadData,
    });
  }
  if (resume && !resume.done && resume.pending.delete(hash)) {
    resume.lastPendingEndAt = at;
    maybeFinishResume(resume);
  }
};

const maybeFinishResume = (episode: Episode) => {
  if (episode.done || episode.collecting || episode.pending.size > 0) return;
  episode.freshAt ??= episode.lastPendingEndAt ?? episode.startedAt;
  if (homeMounted && anyLoading(gates)) return;
  finishResume(episode, {});
};

const finishResume = (
  episode: Episode,
  { timedOut, interrupted }: { timedOut?: boolean; interrupted?: boolean },
) => {
  if (episode.done) return;
  episode.done = true;
  if (episode.timeout) clearTimeout(episode.timeout);
  const at = perfNow();
  const stillLoading = episode.everLoading && episode.readyAt === undefined;
  const homeReadyMs = !episode.homeMounted
    ? undefined
    : !episode.everLoading
      ? 0
      : spanMs(episode.startedAt, stillLoading ? at : episode.readyAt);
  const freshMs = spanMs(episode.startedAt, episode.freshAt ?? (timedOut ? at : undefined));
  const slow =
    !!timedOut || (homeReadyMs ?? 0) > 0 || (freshMs ?? 0) >= SLOW_FRESH_MS || stillLoading;
  const sampleRate = slow ? 1 : FAST_RESUME_SAMPLE_RATE;
  if (!slow && Math.random() >= sampleRate) return;

  const waits = gateWaits(episode, episode.startedAt);
  const queries = slowQueriesSince(episode.startedAt);
  const tokenFetch = getTokenFetchTimingSince(episode.startedAt);
  const auth = getAuthRefreshSince(episode.startedAt);
  const pendingFamilies = [
    ...new Set([...episode.pending].map(hash => inFlight.get(hash)?.family).filter(Boolean)),
  ];

  track(TRACKING_EVENTS.APP_RESUME_TIMING, {
    sample_rate: sampleRate,
    background_ms: episode.backgroundMs,
    home_mounted: episode.homeMounted,
    home_ready_ms: homeReadyMs,
    fresh_ms: freshMs,
    skeleton_shown: episode.skeletonShown,
    snapshot_shown: episode.snapshotShown,
    snapshot_age_ms: episode.snapshotAgeMs,
    timed_out: !!timedOut,
    interrupted: !!interrupted,
    still_loading: stillLoading,
    slowest_gate: waits[0]?.gate,
    gate_waits: Object.fromEntries(waits.map(wait => [wait.gate, wait.ms])),
    slow_queries: queries.map(query => `${query.key}:${query.ms}`).join(','),
    pending_queries: pendingFamilies.join(','),
    auth_refresh_ms: auth?.ms,
    auth_refresh_failed: auth ? !auth.ok : undefined,
    token_fetch_ms: tokenFetch?.totalMs,
    token_reads_ms: tokenFetch?.readsMs,
    token_pricing_ms: tokenFetch?.pricingMs,
    token_slowest_chain: tokenFetch?.slowestChain,
    token_failed_chains: tokenFetch?.failedChains.join(','),
  });

  reportPerfSample({
    kind: 'resume',
    sampleRate,
    homeReadyMs,
    freshMs,
    backgroundMs: episode.backgroundMs,
    authRefreshMs: auth?.ms,
    skeletonShown: episode.skeletonShown,
    snapshotShown: episode.snapshotShown,
    snapshotAgeMs: episode.snapshotAgeMs,
    timedOut: !!timedOut,
    interrupted: !!interrupted,
    slowestGate: waits[0]?.gate,
    gateWaits: waits,
    slowQueries: queries,
    tokenFetch: tokenFetchFields(tokenFetch),
  });
};

const startResume = (backgroundMs: number) => {
  // The first time the app is seen is the launch's to report.
  if (!startupDone) return;
  if (resume && !resume.done) finishResume(resume, { interrupted: true });
  const at = perfNow();
  const episode = newEpisode('resume', at);
  episode.backgroundMs = backgroundMs;
  if (homeMounted) {
    episode.homeMounted = true;
    if (anyLoading(gates)) applyGates(episode, gates, lastKnownSavedAt, at);
  }
  // Refetches already under way, and those the return starts in the next moment.
  for (const [hash] of inFlight) episode.pending.add(hash);
  episode.collecting = true;
  resume = episode;
  setTimeout(() => {
    episode.collecting = false;
    maybeFinishResume(episode);
  }, RESUME_COLLECT_MS);
  episode.timeout = setTimeout(() => finishResume(episode, { timedOut: true }), RESUME_TIMEOUT_MS);
};

const onAppStateChange = (status: AppStateStatus) => {
  if (status === 'active') {
    everActive = true;
    if (backgroundSince !== null) {
      const away = Date.now() - backgroundSince;
      backgroundSince = null;
      if (away >= RESUME_MIN_BACKGROUND_MS) startResume(away);
    }
    return;
  }
  // iOS passes through `inactive` for the app switcher and control centre: not away yet.
  if (status !== 'background') return;
  backgroundSince ??= Date.now();
  // Left before home was ever ready: the launch report, if it comes, says so itself.
  if (everActive) startupDone = true;
  if (resume && !resume.done) finishResume(resume, { interrupted: true });
};

/**
 * Start watching the balance queries and the app's foreground state. Call once,
 * at startup, with the app's query client. Returns an unsubscribe function.
 */
export const installHomeLoadTiming = (queryClient: QueryClient): (() => void) => {
  if (installed) return () => {};
  installed = true;
  watchNetworkType();
  const unsubscribeCache = queryClient.getQueryCache().subscribe((event: QueryCacheNotifyEvent) => {
    const family = event.query.queryKey[0];
    if (typeof family !== 'string' || !GATE_QUERY_FAMILIES.has(family)) return;
    const hash = event.query.queryHash;
    if (event.type === 'removed') {
      onFetchEnd(hash, 'cancelled');
      return;
    }
    if (event.type !== 'updated') return;
    const { action } = event;
    if (action.type === 'fetch') {
      if (!inFlight.has(hash)) onFetchStart(hash, family, event.query.state.data !== undefined);
    } else if (action.type === 'success') {
      onFetchEnd(hash, 'success');
    } else if (action.type === 'error') {
      onFetchEnd(hash, 'error');
    } else if (inFlight.has(hash) && event.query.state.fetchStatus === 'idle') {
      // Cancelled or reverted without a result: it no longer holds anything up.
      onFetchEnd(hash, 'cancelled');
    }
  });
  const subscription = AppState.addEventListener('change', onAppStateChange);
  const unsubscribeTokenTiming = onTokenFetchTiming(onTokenFetch);
  return () => {
    unsubscribeCache();
    unsubscribeTokenTiming();
    subscription.remove();
    installed = false;
  };
};
