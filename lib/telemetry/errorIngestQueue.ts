import { AppState, Platform } from 'react-native';

import { getJWTToken, getPlatformHeaders } from '@/lib/api';
import { EXPO_PUBLIC_ERRORS_INGEST_ENABLED, EXPO_PUBLIC_FLASH_API_BASE_URL } from '@/lib/config';
import { fetchWithTimeout } from '@/lib/fetchWithTimeout';

import type { ClientErrorEvent } from '@/lib/telemetry/types';

/**
 * Batches app errors to the accounts service for the admin Errors page.
 *
 * Errors come in bursts — one failed request usually means a failed flow event
 * and an error toast right behind it, and a broken screen can repeat the same
 * failure on every render — so events are queued and sent together instead of
 * one request each. Delivery is best effort: the queue is in memory only, a
 * batch that fails twice is dropped, and nothing here ever throws or reports
 * its own failures (that would feed straight back into the queue).
 */

export const ERROR_INGEST_URL = `${EXPO_PUBLIC_FLASH_API_BASE_URL}/accounts/v1/errors/ingest`;

/** Send whatever is queued this long after the first event of a batch. */
export const FLUSH_INTERVAL_MS = 2_000;
/** ...or straight away once this many are waiting. */
export const FLUSH_AT = 20;
/** The endpoint takes 1..50 events per request. */
export const MAX_BATCH = 50;
/** Past this the oldest events are dropped: a crash loop must not grow memory. */
export const MAX_QUEUED = 200;
/** Identical events (kind + code + message + endpoint) inside this window are sent once. */
export const DEDUPE_WINDOW_MS = 5_000;
/** One retry per batch, this long after the first attempt failed. */
export const RETRY_DELAY_MS = 3_000;
/** A request that hangs would otherwise hold up every batch behind it. */
const SEND_TIMEOUT_MS = 15_000;
/** Browsers refuse `keepalive` requests above 64 KiB, so a bigger page-hide flush goes without it. */
const KEEPALIVE_MAX_BYTES = 60_000;

/**
 * Off in dev builds, when switched off by env, when there is no backend to send
 * to, and while the web build is pre-rendered in Node (no `window`).
 */
export const isErrorIngestEnabled = (): boolean =>
  !__DEV__ &&
  EXPO_PUBLIC_ERRORS_INGEST_ENABLED &&
  !!EXPO_PUBLIC_FLASH_API_BASE_URL &&
  (Platform.OS !== 'web' || typeof window !== 'undefined');

let queue: ClientErrorEvent[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let flushing = false;
let lifecycleListening = false;
/** Dedupe key → when an event with that key was last accepted. */
const recentlySeen = new Map<string, number>();

const dedupeKey = (event: ClientErrorEvent) =>
  [event.kind, event.code ?? '', event.message, event.endpoint ?? ''].join('\u0000');

const pruneRecentlySeen = (now: number) => {
  for (const [key, seenAt] of recentlySeen) {
    if (now - seenAt >= DEDUPE_WINDOW_MS) recentlySeen.delete(key);
  }
};

const scheduleFlush = () => {
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    void flushErrorEvents();
  }, FLUSH_INTERVAL_MS);
};

const wait = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

type SendResult = 'sent' | 'retry' | 'drop';

const post = async (
  body: string,
  { anonymous, keepalive }: { anonymous: boolean; keepalive: boolean },
): Promise<Response> => {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...getPlatformHeaders(),
  };
  const jwt = anonymous ? null : getJWTToken();
  if (jwt) headers.Authorization = `Bearer ${jwt}`;

  return fetchWithTimeout(
    ERROR_INGEST_URL,
    {
      method: 'POST',
      headers,
      // Web authenticates with cookies; the anonymous retry must not send them.
      credentials: anonymous ? 'omit' : 'include',
      body,
      ...(keepalive ? { keepalive: true } : {}),
    },
    SEND_TIMEOUT_MS,
  );
};

/**
 * One attempt at delivering a batch. A 401 is retried once straight away
 * without credentials rather than refreshing the session: the endpoint takes
 * anonymous events, and a refresh from here could loop with the very failure
 * being reported.
 */
const send = async (events: ClientErrorEvent[], keepalive: boolean): Promise<SendResult> => {
  try {
    const body = JSON.stringify({ events });
    const useKeepalive = keepalive && body.length <= KEEPALIVE_MAX_BYTES;
    let response = await post(body, { anonymous: false, keepalive: useKeepalive });
    if (response.status === 401) {
      response = await post(body, { anonymous: true, keepalive: useKeepalive });
    }
    if (response.ok) return 'sent';
    // Throttled or the server is struggling: worth one more try. Anything else
    // (a 400 for a malformed batch, say) will fail the same way again.
    return response.status === 429 || response.status >= 500 ? 'retry' : 'drop';
  } catch {
    // Offline, timed out or cut off.
    return 'retry';
  }
};

/**
 * Send everything queued, in batches of {@link MAX_BATCH}. A batch that fails
 * is retried once after {@link RETRY_DELAY_MS} and then dropped.
 */
export const flushErrorEvents = async ({ keepalive = false } = {}): Promise<void> => {
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  // The flush in flight picks up anything queued meanwhile.
  if (flushing || queue.length === 0) return;

  flushing = true;
  try {
    while (queue.length > 0) {
      const batch = queue.splice(0, MAX_BATCH);
      if ((await send(batch, keepalive)) === 'retry') {
        await wait(RETRY_DELAY_MS);
        await send(batch, keepalive);
      }
    }
  } catch {
    // Never let delivery problems escape into the app.
  } finally {
    flushing = false;
    if (queue.length > 0) scheduleFlush();
  }
};

/** Flush as the app leaves the foreground, while the JS thread still runs. */
const listenForLifecycle = () => {
  if (lifecycleListening) return;
  lifecycleListening = true;
  try {
    AppState.addEventListener('change', state => {
      if (state === 'background' || state === 'inactive') void flushErrorEvents();
    });
    if (Platform.OS === 'web' && typeof window !== 'undefined' && window.addEventListener) {
      window.addEventListener('pagehide', () => void flushErrorEvents({ keepalive: true }));
    }
  } catch {
    // Lifecycle flushing is a nicety; the interval flush still runs.
  }
};

/**
 * Queue an event for delivery. Returns false when it was dropped as a
 * duplicate of one accepted within the last {@link DEDUPE_WINDOW_MS}.
 */
export const enqueueErrorEvent = (event: ClientErrorEvent): boolean => {
  const now = Date.now();
  const key = dedupeKey(event);
  const seenAt = recentlySeen.get(key);
  if (seenAt !== undefined && now - seenAt < DEDUPE_WINDOW_MS) return false;

  if (recentlySeen.size >= MAX_QUEUED) pruneRecentlySeen(now);
  recentlySeen.set(key, now);

  queue.push(event);
  if (queue.length > MAX_QUEUED) queue.splice(0, queue.length - MAX_QUEUED);

  listenForLifecycle();
  if (queue.length >= FLUSH_AT) void flushErrorEvents();
  else scheduleFlush();
  return true;
};

/** Test seam: the module state would otherwise leak between cases. */
export const __resetErrorIngestQueue = () => {
  if (flushTimer) clearTimeout(flushTimer);
  flushTimer = null;
  flushing = false;
  queue = [];
  recentlySeen.clear();
};

/** Test seam: what is waiting to be sent. */
export const __getQueuedErrorEvents = (): readonly ClientErrorEvent[] => queue;
