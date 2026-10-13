import { AppState, Platform } from 'react-native';
import Constants from 'expo-constants';
import { dehydrate, hydrate } from '@tanstack/react-query';

import mmkvStorage from '@/lib/mmvkStorage';
import { useUserStore } from '@/store/useUserStore';

import type {
  DehydratedState,
  Query,
  QueryCacheNotifyEvent,
  QueryClient,
  QueryKey,
} from '@tanstack/react-query';

/**
 * Keeps the home screen's data between launches, so a returning user sees their
 * last balance on the first frame and it updates in place, instead of skeletons
 * while a dozen sources are fetched again.
 *
 * Only the queries listed in {@link PERSISTED_QUERIES} are written, only after
 * they succeed, only for the signed-in user, and every restored query is marked
 * stale so it is fetched again as soon as something reads it. The cache is
 * thrown away when it was written for another user, by another app version or
 * {@link QUERY_CACHE_VERSION}, or is older than {@link MAX_AGE_MS}, and is wiped
 * as soon as the selected account changes or the in-memory cache is cleared
 * (every sign-out and account switch calls `queryClient.clear()`).
 */

/**
 * Bump when the data a persisted query returns changes shape in a way the
 * screens reading it can't handle, so older cached copies are dropped instead
 * of rendered.
 */
export const QUERY_CACHE_VERSION = 1;

const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
// Polled queries succeed every few seconds; batch their writes.
const WRITE_THROTTLE_MS = 2_000;
// Rewrite unchanged data now and then so its age stays accurate.
const REWRITE_UNCHANGED_AFTER_MS = 60_000;
const STORAGE_KEY = 'home';

/**
 * What the home screen needs to draw its balances, card and banners. The value
 * narrows a query family to the keys that are safe to keep: plain JSON (no
 * bigint), and nothing the user would not want written to the device.
 */
const PERSISTED_QUERIES: Record<string, (queryKey: QueryKey) => boolean> = {
  tokenBalances: () => true,
  // Only the USD-number balances; the `*Wei` siblings hold bigints.
  vault: queryKey => queryKey[1] === 'balance',
  vaultExchangeRate: () => true,
  fusePriceUsd: () => true,
  ethPriceUsd: () => true,
  tierMembership: () => true,
  portfolioCustody: () => true,
  cardStatus: () => true,
  cardDetails: () => true,
  cardBalance: () => true,
  analytics: queryKey => queryKey[1] === 'apys',
  'user-transactions': () => true,
  'promotions-banner': () => true,
  rewards: queryKey => queryKey[1] === 'userData',
};

export const isPersistedQueryKey = (queryKey: QueryKey): boolean => {
  const family = queryKey[0];
  return typeof family === 'string' && !!PERSISTED_QUERIES[family]?.(queryKey);
};

/**
 * Card details carry the expiry, BIN and cardholder name, none of which the
 * home screen draws. Keep them off the disk; the screens that show them read
 * them with optional chaining and get them back from the refetch.
 */
const redactForDisk = (queryKey: QueryKey, data: unknown): unknown => {
  if (queryKey[0] !== 'cardDetails' || !data || typeof data !== 'object') return data;
  const {
    card_details: cardDetails,
    cardholder_name: _name,
    ...rest
  } = data as {
    card_details?: { last_4?: string };
    cardholder_name?: unknown;
  };
  return cardDetails ? { ...rest, card_details: { last_4: cardDetails.last_4 } } : rest;
};

/** Data the screens can't read is dropped rather than rendered. */
const isReadable = (queryKey: QueryKey, data: unknown): boolean => {
  if (data === undefined) return false;
  if (queryKey[0] === 'tokenBalances') {
    const balances = data as { tokens?: unknown; unifiedTokens?: unknown; totalUSD?: unknown };
    return (
      Array.isArray(balances?.tokens) &&
      Array.isArray(balances?.unifiedTokens) &&
      typeof balances?.totalUSD === 'number'
    );
  }
  return true;
};

type PersistedCache = {
  version: number;
  appVersion: string;
  userId: string;
  state: DehydratedState;
};

// JSON has no bigint. None of the persisted queries should hold one, but a
// shape change must not make every write throw.
const replacer = (_key: string, value: unknown) =>
  typeof value === 'bigint' ? { __bigint: value.toString() } : value;
const reviver = (_key: string, value: unknown) =>
  value && typeof value === 'object' && '__bigint' in value && Object.keys(value).length === 1
    ? BigInt((value as { __bigint: string }).__bigint)
    : value;

const appVersion = () => Constants.expoConfig?.version ?? '';

const selectedUserId = (): string | undefined =>
  useUserStore.getState().users.find(user => user.selected)?.userId;

const canUseStorage = () => !(Platform.OS === 'web' && typeof window === 'undefined');

let storage: ReturnType<typeof mmkvStorage> | null = null;
const getStorage = () => {
  if (!storage && canUseStorage()) storage = mmkvStorage('query-cache');
  return storage;
};

const removePersisted = () => {
  try {
    getStorage()?.removeItem(STORAGE_KEY);
  } catch {
    // Nothing to clean up if storage is unavailable.
  }
};

// Set by clearPersistedQueryCache: the in-memory cache may still hold the data
// that broke the render, so nothing more is written until the next launch.
let persistenceStopped = false;

/**
 * Drop the copy on disk. Called when the app hits a render error: if data
 * restored from an older version is what broke it, the next launch starts
 * clean instead of failing the same way until the copy ages out.
 */
export const clearPersistedQueryCache = () => {
  persistenceStopped = true;
  removePersisted();
};

type GlobalErrorHandler = (error: unknown, isFatal?: boolean) => void;

/**
 * The same for a fatal error outside rendering (an effect, a callback), which
 * no error boundary sees. Native only; wraps whatever handler is installed
 * (the error tracker's) and calls it as before.
 */
export const clearPersistedQueryCacheOnFatalError = () => {
  const errorUtils = (
    globalThis as {
      ErrorUtils?: {
        getGlobalHandler: () => GlobalErrorHandler | undefined;
        setGlobalHandler: (handler: GlobalErrorHandler) => void;
      };
    }
  ).ErrorUtils;
  if (Platform.OS === 'web' || !errorUtils) return;

  const previous = errorUtils.getGlobalHandler();
  errorUtils.setGlobalHandler((error, isFatal) => {
    if (isFatal) clearPersistedQueryCache();
    previous?.(error, isFatal);
  });
};

let restoredQueryCount = 0;

/** How many queries the last {@link restoreQueryCache} put back; reported with startup timing. */
export const getRestoredQueryCount = () => restoredQueryCount;

/**
 * Put the persisted queries back into the cache. Synchronous (MMKV), so it runs
 * before the first render and the home screen never draws an empty frame.
 */
export const restoreQueryCache = (queryClient: QueryClient): number => {
  restoredQueryCount = 0;
  try {
    const raw = getStorage()?.getItem(STORAGE_KEY);
    if (!raw) return 0;

    const cache = JSON.parse(raw, reviver) as PersistedCache;
    const userId = selectedUserId();
    if (
      cache?.version !== QUERY_CACHE_VERSION ||
      cache.appVersion !== appVersion() ||
      !userId ||
      cache.userId !== userId ||
      !Array.isArray(cache.state?.queries)
    ) {
      removePersisted();
      return 0;
    }

    const now = Date.now();
    const queries = cache.state.queries
      .filter(
        query =>
          isPersistedQueryKey(query.queryKey) &&
          query.state.status === 'success' &&
          now - query.state.dataUpdatedAt < MAX_AGE_MS &&
          isReadable(query.queryKey, query.state.data),
      )
      // Stale on arrival: whatever reads it fetches the live value straight away.
      .map(query => ({ ...query, state: { ...query.state, isInvalidated: true } }));

    hydrate(queryClient, { mutations: [], queries });
    restoredQueryCount = queries.length;
    return queries.length;
  } catch (error) {
    console.warn('Discarding unreadable query cache:', error);
    removePersisted();
    return 0;
  }
};

/**
 * Write the persisted queries whenever one of them succeeds or goes away, at
 * most every {@link WRITE_THROTTLE_MS}, and straight away when the app goes to
 * the background. Returns an unsubscribe function.
 */
export const persistQueryCache = (queryClient: QueryClient): (() => void) => {
  const queryCache = queryClient.getQueryCache();
  // The data each query had at the last write, to skip polls that changed nothing.
  // React Query keeps the same reference when a refetch returns equal data.
  const writtenData = new Map<string, unknown>();
  let lastWriteAt = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const cancelPending = () => {
    if (timer) clearTimeout(timer);
    timer = null;
  };

  const write = () => {
    cancelPending();
    if (persistenceStopped) return;
    const userId = selectedUserId();
    try {
      // Anything holding data, including a query whose latest refetch failed: its
      // last good data is what the next launch should show.
      const state = dehydrate(queryClient, {
        shouldDehydrateQuery: (query: Query) =>
          query.state.data !== undefined &&
          query.state.dataUpdatedAt > ownerSince &&
          isPersistedQueryKey(query.queryKey),
      });
      if (!userId || state.queries.length === 0) {
        removePersisted();
        writtenData.clear();
        return;
      }

      writtenData.clear();
      state.queries.forEach(query => writtenData.set(query.queryHash, query.state.data));

      const cache: PersistedCache = {
        version: QUERY_CACHE_VERSION,
        appVersion: appVersion(),
        userId,
        state: {
          mutations: [],
          queries: state.queries.map(query => ({
            ...query,
            state: {
              ...query.state,
              data: redactForDisk(query.queryKey, query.state.data),
              // Stored as plain data: a failed refetch's error is no use next launch.
              status: 'success' as const,
              fetchStatus: 'idle' as const,
              error: null,
              errorUpdatedAt: 0,
              fetchFailureCount: 0,
              fetchFailureReason: null,
            },
          })),
        },
      };
      getStorage()?.setItem(STORAGE_KEY, JSON.stringify(cache, replacer));
      lastWriteAt = Date.now();
    } catch (error) {
      console.warn('Could not persist query cache:', error);
    }
  };

  const schedule = () => {
    if (!timer) timer = setTimeout(write, WRITE_THROTTLE_MS);
  };

  // When the selected account changes, what is already in memory was fetched
  // for the previous one. Drop the copy on disk and keep only data fetched
  // afterwards: every switch clears the cache too, but the welcome screen
  // selects the account first and clears it only when the passkey prompt starts.
  let ownerId = selectedUserId();
  let ownerSince = 0;
  const unsubscribeUser = useUserStore.subscribe(state => {
    const userId = state.users.find(user => user.selected)?.userId;
    if (userId === ownerId) return;
    ownerId = userId;
    ownerSince = Date.now();
    cancelPending();
    writtenData.clear();
    removePersisted();
  });

  const unsubscribeCache = queryCache.subscribe((event: QueryCacheNotifyEvent) => {
    if (event.type === 'removed') {
      // `queryClient.clear()` (sign-out, account switch) empties the cache:
      // drop the copy on disk now rather than after the throttle.
      if (queryCache.getAll().length === 0) {
        cancelPending();
        writtenData.clear();
        removePersisted();
        return;
      }
      if (isPersistedQueryKey(event.query.queryKey)) schedule();
      return;
    }

    if (
      event.type === 'updated' &&
      event.action.type === 'success' &&
      isPersistedQueryKey(event.query.queryKey)
    ) {
      const unchanged = writtenData.get(event.query.queryHash) === event.query.state.data;
      if (!unchanged || Date.now() - lastWriteAt > REWRITE_UNCHANGED_AFTER_MS) schedule();
    }
  });

  // iOS can end a suspended app without warning, so save before suspension.
  const appStateSubscription = AppState.addEventListener('change', status => {
    if (status !== 'active' && timer) write();
  });

  return () => {
    cancelPending();
    unsubscribeCache();
    unsubscribeUser();
    appStateSubscription.remove();
  };
};
