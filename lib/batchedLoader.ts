/**
 * Merges lookups started in the same tick into as few upstream requests as the
 * API allows, and caches what comes back so repeat lookups stay local.
 *
 * Built for Alchemy's Prices API, whose quota is counted in requests — 10,000
 * an hour per app on Pay As You Go, shared by every client of the app — while a
 * single request carries up to 25 tokens at the same 40 CU. Asking for one
 * price per request with nothing kept spent that quota several times over on
 * every balance refresh, and 429'd everyone once it ran out.
 */

type Entry<V> = {
  /** Last value upstream returned. Kept past its TTL, up to `maxStaleMs`. */
  value?: V;
  /** When `value` was fetched. */
  fetchedAt?: number;
  /** Until then the key is answered from the cache without asking upstream. */
  freshUntil: number;
};

/** A pause on upstream calls, shareable between loaders drawing on one quota. */
export type Cooldown = { until: number };

export type BatchedLoaderOptions<V> = {
  /** Splits one flush's keys into groups that each fit in a single request. */
  chunk: (keys: string[]) => string[][];
  /** Fetches one group. Keys absent from the result have no value upstream. */
  fetchChunk: (keys: string[]) => Promise<Map<string, V>>;
  /** How long a fetched value is reused before asking upstream again. */
  ttlMs: number;
  /** How long to wait before asking again about a key upstream had no value for. */
  missTtlMs: number;
  /** How long to wait before retrying keys whose request failed. */
  errorTtlMs: number;
  /** How long a value stays usable past its TTL when refreshing it fails or is skipped. */
  maxStaleMs: number;
  /**
   * How long a failure should stop every upstream call, if at all. Meant for
   * rate limits: once the quota is spent, each further request until it refills
   * is refused anyway.
   */
  cooldownMs?: (error: unknown) => number | undefined;
  /** Pass the same object to loaders that share a quota so one 429 pauses them all. */
  cooldown?: Cooldown;
  now?: () => number;
};

export type BatchedLoader<V> = {
  /** Values for the keys that have one. Never rejects. */
  load: (keys: string[]) => Promise<Map<string, V>>;
  /** Forgets every cached value and lifts any pause. */
  clear: () => void;
};

export const createBatchedLoader = <V>(options: BatchedLoaderOptions<V>): BatchedLoader<V> => {
  const now = options.now ?? (() => Date.now());
  const cooldown = options.cooldown ?? { until: 0 };
  const cache = new Map<string, Entry<V>>();
  // Keys queued for, or waiting on, a request that hasn't settled yet.
  const pending = new Map<string, Promise<void>>();
  let queue: string[] = [];
  let scheduled: Promise<void> | undefined;

  const settle = (keys: string[], freshForMs: number, values?: Map<string, V>) => {
    const at = now();
    for (const key of keys) {
      const value = values?.get(key);
      cache.set(
        key,
        value === undefined
          ? { ...cache.get(key), freshUntil: at + freshForMs }
          : { value, fetchedAt: at, freshUntil: at + options.ttlMs },
      );
    }
  };

  const fetchGroup = async (keys: string[]) => {
    try {
      settle(keys, options.missTtlMs, await options.fetchChunk(keys));
    } catch (error) {
      const pauseMs = options.cooldownMs?.(error);
      if (pauseMs) cooldown.until = Math.max(cooldown.until, now() + pauseMs);
      settle(keys, options.errorTtlMs);
    }
  };

  const flush = async () => {
    const keys = queue;
    queue = [];
    scheduled = undefined;
    try {
      await Promise.all(options.chunk(keys).map(fetchGroup));
    } finally {
      for (const key of keys) pending.delete(key);
    }
  };

  const load = async (keys: string[]) => {
    const unique = [...new Set(keys)];
    const at = now();
    for (const key of unique) {
      if (pending.has(key) || at < cooldown.until) continue;
      if ((cache.get(key)?.freshUntil ?? 0) > at) continue;
      queue.push(key);
      // Wait out the current tick so every lookup started in it rides one flush.
      scheduled ??= new Promise<void>(resolve => setTimeout(resolve, 0)).then(flush);
      pending.set(key, scheduled);
    }
    await Promise.allSettled(unique.map(key => pending.get(key)));

    const values = new Map<string, V>();
    const readAt = now();
    for (const key of unique) {
      const entry = cache.get(key);
      if (entry?.value !== undefined && readAt - (entry.fetchedAt ?? 0) <= options.maxStaleMs) {
        values.set(key, entry.value);
      }
    }
    return values;
  };

  const clear = () => {
    cache.clear();
    cooldown.until = 0;
  };

  return { load, clear };
};
