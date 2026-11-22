import { AppState, Platform } from 'react-native';
import Constants from 'expo-constants';

import { captureAccountScope } from '@/lib/accountScope';
import { getJWTToken, getPlatformHeaders } from '@/lib/api';
import { EXPO_PUBLIC_FLASH_API_BASE_URL } from '@/lib/config';
import { fetchWithTimeout } from '@/lib/fetchWithTimeout';
import { getNetworkType } from '@/lib/telemetry/networkType';
import { getRunningUpdateId } from '@/lib/telemetry/perfClock';

/**
 * Sends launch and resume timing to the accounts service
 * (POST /accounts/v1/app-performance), where support and the admin portal can
 * see, per user, how long the home screen took to show balances and what held
 * it up — the same figures Amplitude gets, but readable for one customer.
 *
 * Best effort and quiet: an in-memory queue, a batch that fails twice is
 * dropped, a 401 never refreshes the session from here, and nothing here throws.
 * Every field is clamped to what the endpoint validates, so one odd value can't
 * get a whole batch refused.
 */

export const APP_PERFORMANCE_URL = `${EXPO_PUBLIC_FLASH_API_BASE_URL}/accounts/v1/app-performance`;

const FLUSH_DELAY_MS = 10_000;
const FLUSH_AT = 10;
/** The endpoint takes 1..20 samples per request. */
const MAX_BATCH = 20;
const MAX_QUEUED = 60;
const MAX_ATTEMPTS = 2;
const SEND_TIMEOUT_MS = 15_000;

const MAX_DURATION_MS = 60 * 60 * 1000;
const MAX_BACKGROUND_MS = 30 * 24 * 60 * 60 * 1000;
const MAX_SNAPSHOT_AGE_MS = 31 * 24 * 60 * 60 * 1000;
const IDENTIFIER = /^[A-Za-z0-9_.:-]+$/;
const APP_VERSION = /^[A-Za-z0-9_.:+()-]+$/;

export type PerfSampleKind = 'startup' | 'resume';

/** What callers report. Identity, time, platform, build and network are filled in here. */
export type PerfSampleInput = {
  kind: PerfSampleKind;
  sampleRate?: number;
  launchKind?: 'cold' | 'ota_reload' | 'page_load' | 'after_login';
  homeReadyMs?: number;
  visibleToReadyMs?: number;
  jsToReadyMs?: number;
  freshMs?: number;
  backgroundMs?: number;
  authRefreshMs?: number;
  skeletonShown?: boolean;
  snapshotShown?: boolean;
  backgrounded?: boolean;
  timedOut?: boolean;
  interrupted?: boolean;
  cacheRestored?: number;
  cacheOutcome?: string;
  snapshotAgeMs?: number;
  slowestGate?: string;
  gateWaits?: { gate: string; ms: number }[];
  slowQueries?: { key: string; ms: number; failed?: boolean }[];
  tokenFetch?: {
    totalMs?: number;
    readsMs?: number;
    pricingMs?: number;
    tokenCount?: number;
    unpricedCount?: number;
    timedOutReads?: number;
    failedChains?: number[];
    slowestChain?: number;
    slowestChainMs?: number;
  };
  jsHeapMb?: number;
};

export type PerfSample = PerfSampleInput & {
  id: string;
  occurredAt: string;
  platform: 'ios' | 'android' | 'web';
  appVersion?: string;
  updateId?: string;
  networkType?: string;
};

type Queued = {
  sample: PerfSample;
  scope: ReturnType<typeof captureAccountScope>;
  attempts: number;
};

let queue: Queued[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;
let flushing = false;
let lifecycleListening = false;

export const isPerfReportingEnabled = (): boolean =>
  !__DEV__ &&
  !!EXPO_PUBLIC_FLASH_API_BASE_URL &&
  (Platform.OS !== 'web' || typeof window !== 'undefined');

const int = (value: unknown, max: number, min = 0): number | undefined =>
  typeof value === 'number' && Number.isFinite(value)
    ? Math.min(max, Math.max(min, Math.round(value)))
    : undefined;

const duration = (value: unknown, max = MAX_DURATION_MS) => int(value, max);

const ident = (value: unknown, maxLength: number): string | undefined =>
  typeof value === 'string' &&
  value.length > 0 &&
  value.length <= maxLength &&
  IDENTIFIER.test(value)
    ? value
    : undefined;

const bool = (value: unknown): boolean | undefined =>
  typeof value === 'boolean' ? value : undefined;

/** A chain id, or undefined: clamping a bad one would name a real chain that didn't fail. */
const chainId = (value: unknown) =>
  typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 10_000_000_000
    ? value
    : undefined;

const sampleId = () =>
  `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`.replace(
    /[^A-Za-z0-9]/g,
    '',
  );

const appVersion = (): string | undefined => {
  const version = Constants.expoConfig?.version;
  return typeof version === 'string' && version.length <= 40 && APP_VERSION.test(version)
    ? version
    : undefined;
};

const compact = <T extends Record<string, unknown>>(value: T): T =>
  Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined)) as T;

/** The sample as the endpoint validates it; anything out of range is clamped or left out. */
export const toPerfSample = (input: PerfSampleInput, now = new Date()): PerfSample => {
  const platform = Platform.OS === 'ios' || Platform.OS === 'android' ? Platform.OS : 'web';
  const tokenFetch = input.tokenFetch
    ? compact({
        totalMs: duration(input.tokenFetch.totalMs),
        readsMs: duration(input.tokenFetch.readsMs),
        pricingMs: duration(input.tokenFetch.pricingMs),
        tokenCount: int(input.tokenFetch.tokenCount, 10_000),
        unpricedCount: int(input.tokenFetch.unpricedCount, 10_000),
        timedOutReads: int(input.tokenFetch.timedOutReads, 100),
        failedChains: input.tokenFetch.failedChains
          ?.map(chainId)
          .filter((id): id is number => id !== undefined)
          .slice(0, 10),
        slowestChain: chainId(input.tokenFetch.slowestChain),
        slowestChainMs: duration(input.tokenFetch.slowestChainMs),
      })
    : undefined;
  const sampleRate =
    typeof input.sampleRate === 'number' && Number.isFinite(input.sampleRate)
      ? Math.min(1, Math.max(0.001, input.sampleRate))
      : undefined;

  return compact({
    id: sampleId(),
    kind: input.kind,
    occurredAt: now.toISOString(),
    platform,
    sampleRate,
    appVersion: appVersion(),
    updateId: ident(getRunningUpdateId(), 64),
    launchKind: input.launchKind,
    homeReadyMs: duration(input.homeReadyMs),
    visibleToReadyMs: duration(input.visibleToReadyMs),
    jsToReadyMs: duration(input.jsToReadyMs),
    freshMs: duration(input.freshMs),
    backgroundMs: duration(input.backgroundMs, MAX_BACKGROUND_MS),
    authRefreshMs: duration(input.authRefreshMs),
    skeletonShown: bool(input.skeletonShown),
    snapshotShown: bool(input.snapshotShown),
    backgrounded: bool(input.backgrounded),
    timedOut: bool(input.timedOut),
    interrupted: bool(input.interrupted),
    cacheRestored: int(input.cacheRestored, 500),
    cacheOutcome: ident(input.cacheOutcome, 32),
    snapshotAgeMs: duration(input.snapshotAgeMs, MAX_SNAPSHOT_AGE_MS),
    slowestGate: ident(input.slowestGate, 48),
    gateWaits: input.gateWaits
      ?.map(wait => ({ gate: ident(wait.gate, 48), ms: duration(wait.ms) }))
      .filter((wait): wait is { gate: string; ms: number } => !!wait.gate && wait.ms !== undefined)
      .slice(0, 8),
    slowQueries: input.slowQueries
      ?.map(query => ({
        key: ident(query.key, 64),
        ms: duration(query.ms),
        failed: bool(query.failed),
      }))
      .filter(
        (query): query is { key: string; ms: number; failed: boolean | undefined } =>
          !!query.key && query.ms !== undefined,
      )
      .map(query => compact(query))
      .slice(0, 10),
    tokenFetch,
    networkType: ident(getNetworkType(), 16),
    jsHeapMb: int(input.jsHeapMb, 100_000),
  }) as PerfSample;
};

const listenForBackground = () => {
  if (lifecycleListening) return;
  lifecycleListening = true;
  // Sent before suspension: iOS may end a suspended app without warning.
  AppState.addEventListener('change', status => {
    if (status === 'background') void flushPerfSamples();
  });
};

const schedule = () => {
  if (timer) return;
  timer = setTimeout(() => {
    timer = null;
    void flushPerfSamples();
  }, FLUSH_DELAY_MS);
};

/** Queue one sample for the backend. Never throws. */
export const reportPerfSample = (input: PerfSampleInput): void => {
  if (!isPerfReportingEnabled()) return;
  try {
    listenForBackground();
    queue.push({ sample: toPerfSample(input), scope: captureAccountScope(), attempts: 0 });
    if (queue.length > MAX_QUEUED) queue = queue.slice(-MAX_QUEUED);
    if (queue.length >= FLUSH_AT) void flushPerfSamples();
    else schedule();
  } catch {
    // Telemetry must never break the screen that reports it.
  }
};

type Outcome = 'sent' | 'retry' | 'drop';

const send = async (batch: Queued[]): Promise<Outcome> => {
  const scope = batch[0].scope;
  if (!scope.isCurrent()) return 'drop';
  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...getPlatformHeaders(),
    };
    const jwt = getJWTToken();
    if (jwt) headers.Authorization = `Bearer ${jwt}`;
    const response = await fetchWithTimeout(
      APP_PERFORMANCE_URL,
      {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify({ samples: batch.map(entry => entry.sample) }),
      },
      SEND_TIMEOUT_MS,
    );
    if (response.ok) return 'sent';
    // An expired token, rate limiting or an outage may pass; a refused shape won't.
    return response.status === 401 || response.status === 429 || response.status >= 500
      ? 'retry'
      : 'drop';
  } catch {
    return 'retry';
  }
};

/** Send everything queued now. Never throws. */
export const flushPerfSamples = async (): Promise<void> => {
  if (flushing || queue.length === 0) return;
  flushing = true;
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  try {
    // One account per request: samples queued before a switch go with their own scope.
    while (queue.length > 0) {
      const generation = queue[0].scope.generation;
      const batch: Queued[] = [];
      while (
        queue.length > 0 &&
        batch.length < MAX_BATCH &&
        queue[0].scope.generation === generation
      ) {
        batch.push(queue.shift()!);
      }
      const outcome = await send(batch);
      if (outcome === 'retry') {
        const again = batch
          .map(entry => ({ ...entry, attempts: entry.attempts + 1 }))
          .filter(entry => entry.attempts < MAX_ATTEMPTS);
        queue = [...again, ...queue].slice(-MAX_QUEUED);
        if (again.length > 0) schedule();
        break;
      }
    }
  } finally {
    flushing = false;
  }
};
