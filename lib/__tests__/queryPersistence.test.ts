/// <reference types="jest" />

import { QueryClient, QueryObserver } from '@tanstack/react-query';

import {
  isPersistedQueryKey,
  persistQueryCache,
  QUERY_CACHE_VERSION,
  restoreQueryCache,
} from '@/lib/queryPersistence';
import { useUserStore } from '@/store/useUserStore';

const mockDisk = new Map<string, string>();

jest.mock('@/lib/mmvkStorage', () => (id: string) => ({
  getItem: (key: string) => mockDisk.get(`${id}:${key}`) ?? null,
  setItem: (key: string, value: string) => mockDisk.set(`${id}:${key}`, value),
  removeItem: (key: string) => mockDisk.delete(`${id}:${key}`),
}));

jest.mock('expo-constants', () => ({ expoConfig: { version: '2.0.2' } }));

const DISK_KEY = 'query-cache:home';
const SAFE = '0x000acC8042eA362149ce2b2709Fc497B6505634E';

const BALANCES = {
  failedChainIds: [],
  totalUSD: 120.5,
  totalUSDExcludingVaultTokens: 20.5,
  tokens: [
    { contractTickerSymbol: 'USDC', balance: '20500000', contractDecimals: 6, chainId: 8453 },
  ],
  unifiedTokens: [],
};

const CARD_DETAILS = {
  id: 'card_1',
  balances: { available: { amount: '42.10', currency: 'USD' } },
  card_details: { last_4: '4242', expiry: '12/29', bin: '411111' },
  cardholder_name: { first_name: 'Ada', last_name: 'Lovelace' },
  cashback: { percentage: 3 },
};

const signIn = (userId: string | null) =>
  useUserStore.setState({
    users: userId ? [{ userId, username: 'mark', selected: true } as never] : [],
  });

const newClient = () => new QueryClient({ defaultOptions: { queries: { retry: false } } });

// Each persister listens to the user store; stop them so one test's sign-ins
// don't reach another's.
const running: (() => void)[] = [];
const persist = (client: QueryClient) => {
  const stop = persistQueryCache(client);
  running.push(stop);
  return stop;
};

/** Fill a client the way a session would, then let the throttled write land. */
const writeSession = (userId = 'u1') => {
  signIn(userId);
  const client = newClient();
  const stop = persist(client);
  client.setQueryData(['tokenBalances', SAFE], BALANCES);
  client.setQueryData(['vault', 'balance', SAFE, 'USDC'], 100);
  client.setQueryData(['cardDetails', userId], CARD_DETAILS);
  client.setQueryData(['cardStatus', userId], null);
  // Not on the list: must never reach the disk.
  client.setQueryData(['customer'], { email: 'ada@example.com' });
  client.setQueryData(['vault', 'balanceSoFuseWei', SAFE], 5n);
  jest.advanceTimersByTime(2_000);
  return { client, stop };
};

beforeEach(() => {
  jest.useFakeTimers();
  mockDisk.clear();
});

afterEach(() => {
  running.splice(0).forEach(stop => stop());
  jest.useRealTimers();
});

describe('isPersistedQueryKey', () => {
  it('keeps the home queries and nothing else', () => {
    expect(isPersistedQueryKey(['tokenBalances', SAFE])).toBe(true);
    expect(isPersistedQueryKey(['vault', 'balance', SAFE, 'USDC'])).toBe(true);
    expect(isPersistedQueryKey(['analytics', 'apys'])).toBe(true);
    expect(isPersistedQueryKey(['rewards', 'userData', 'u1'])).toBe(true);

    expect(isPersistedQueryKey(['vault', 'balanceSoFuseWei', SAFE])).toBe(false);
    expect(isPersistedQueryKey(['analytics', 'historicalAPY', '7', 'usdc'])).toBe(false);
    expect(isPersistedQueryKey(['rewards', 'yieldBoost', 'u1'])).toBe(false);
    expect(isPersistedQueryKey(['customer'])).toBe(false);
    expect(isPersistedQueryKey([{ entity: 'readContract' }])).toBe(false);
  });
});

describe('persist then restore', () => {
  it('puts the home queries back before anything renders, marked for refetch', () => {
    const { client, stop } = writeSession();
    stop();
    client.clear();

    const restored = newClient();
    expect(restoreQueryCache(restored)).toBe(4);

    const balances = restored.getQueryState(['tokenBalances', SAFE]);
    expect(balances?.status).toBe('success');
    expect(balances?.data).toEqual(BALANCES);
    expect(balances?.isInvalidated).toBe(true);
    expect(restored.getQueryData(['vault', 'balance', SAFE, 'USDC'])).toBe(100);
    // A cardless user's `null` is an answer, and is kept.
    expect(restored.getQueryState(['cardStatus', 'u1'])?.status).toBe('success');
    expect(restored.getQueryData(['customer'])).toBeUndefined();
    expect(restored.getQueryData(['vault', 'balanceSoFuseWei', SAFE])).toBeUndefined();
  });

  it('keeps the card expiry, BIN and cardholder name off the disk', () => {
    writeSession();
    const disk = mockDisk.get(DISK_KEY)!;
    expect(disk).not.toContain('12/29');
    expect(disk).not.toContain('411111');
    expect(disk).not.toContain('Lovelace');

    const restored = newClient();
    restoreQueryCache(restored);
    expect(restored.getQueryData(['cardDetails', 'u1'])).toEqual({
      id: 'card_1',
      balances: CARD_DETAILS.balances,
      card_details: { last_4: '4242' },
      cashback: CARD_DETAILS.cashback,
    });
  });

  it('serves the restored data without a loading state, then fetches the live value', async () => {
    writeSession();
    const restored = newClient();
    restoreQueryCache(restored);

    const queryFn = jest.fn().mockResolvedValue({ ...BALANCES, totalUSD: 130 });
    const observer = new QueryObserver(restored, { queryKey: ['tokenBalances', SAFE], queryFn });

    const first = observer.getCurrentResult();
    expect(first.isLoading).toBe(false);
    expect(first.data).toEqual(BALANCES);

    const unsubscribe = observer.subscribe(() => {});
    expect(queryFn).toHaveBeenCalledTimes(1);
    await jest.runAllTimersAsync();
    expect(observer.getCurrentResult().data).toEqual({ ...BALANCES, totalUSD: 130 });
    unsubscribe();
  });

  it('never shows one user the cache written for another', () => {
    writeSession('u1');
    signIn('u2');
    expect(restoreQueryCache(newClient())).toBe(0);
    expect(mockDisk.has(DISK_KEY)).toBe(false);
  });

  it('restores nothing when nobody is signed in', () => {
    writeSession('u1');
    signIn(null);
    expect(restoreQueryCache(newClient())).toBe(0);
  });

  it('drops a cache written under another cache version or app version', () => {
    writeSession();
    const stored = JSON.parse(mockDisk.get(DISK_KEY)!);

    mockDisk.set(DISK_KEY, JSON.stringify({ ...stored, version: QUERY_CACHE_VERSION + 1 }));
    expect(restoreQueryCache(newClient())).toBe(0);

    mockDisk.set(DISK_KEY, JSON.stringify({ ...stored, appVersion: '2.0.1' }));
    expect(restoreQueryCache(newClient())).toBe(0);
  });

  it('drops data older than a week', () => {
    writeSession();
    jest.setSystemTime(Date.now() + 8 * 24 * 60 * 60 * 1000);
    expect(restoreQueryCache(newClient())).toBe(0);
  });

  it('drops a balances entry the screens could not read', () => {
    writeSession();
    const stored = JSON.parse(mockDisk.get(DISK_KEY)!);
    stored.state.queries = stored.state.queries.map((query: any) =>
      query.queryKey[0] === 'tokenBalances'
        ? { ...query, state: { ...query.state, data: { totalUSD: 1 } } }
        : query,
    );
    mockDisk.set(DISK_KEY, JSON.stringify(stored));

    const restored = newClient();
    expect(restoreQueryCache(restored)).toBe(3);
    expect(restored.getQueryData(['tokenBalances', SAFE])).toBeUndefined();
  });

  it('survives a corrupt cache by discarding it', () => {
    mockDisk.set(DISK_KEY, '{not json');
    signIn('u1');
    expect(restoreQueryCache(newClient())).toBe(0);
    expect(mockDisk.has(DISK_KEY)).toBe(false);
  });

  it('keeps the last good data of a query whose refetch then failed', () => {
    const { client } = writeSession();
    const query = client.getQueryCache().find({ queryKey: ['cardStatus', 'u1'] })!;
    client.setQueryData(['cardStatus', 'u1'], { status: 'active' });
    query.setState({ status: 'error', error: new Error('502'), errorUpdatedAt: Date.now() });
    jest.advanceTimersByTime(2_000);

    const restored = newClient();
    restoreQueryCache(restored);
    const state = restored.getQueryState(['cardStatus', 'u1']);
    expect(state?.status).toBe('success');
    expect(state?.data).toEqual({ status: 'active' });
    expect(state?.error).toBeNull();
  });

  it('never persists a query that has no data', () => {
    signIn('u1');
    const client = newClient();
    persist(client);
    client
      .getQueryCache()
      .build(client, { queryKey: ['tierMembership', 'u1'] })
      .setState({ status: 'error', error: new Error('boom'), errorUpdatedAt: Date.now() });
    client.setQueryData(['vault', 'balance', SAFE, 'USDC'], 1);
    jest.advanceTimersByTime(2_000);

    expect(mockDisk.get(DISK_KEY)).not.toContain('tierMembership');
  });
});

describe('sign-out', () => {
  it('wipes the disk copy as soon as the cache is cleared', () => {
    const { client } = writeSession();
    expect(mockDisk.has(DISK_KEY)).toBe(true);

    client.clear();
    expect(mockDisk.has(DISK_KEY)).toBe(false);
  });

  it('never writes one account’s data under the next, even before the cache is cleared', () => {
    const { client } = writeSession('u1');

    // The welcome screen selects the next account before it clears the cache.
    signIn('u2');
    expect(mockDisk.has(DISK_KEY)).toBe(false);

    jest.advanceTimersByTime(1);
    client.setQueryData(['cardStatus', 'u2'], { status: 'active' });
    jest.advanceTimersByTime(2_000);

    const stored = JSON.parse(mockDisk.get(DISK_KEY)!);
    expect(stored.userId).toBe('u2');
    expect(stored.state.queries.map((query: any) => query.queryKey)).toEqual([
      ['cardStatus', 'u2'],
    ]);
  });

  it('does not write data fetched after the user was signed out', () => {
    const { client } = writeSession();
    client.clear();
    signIn(null);
    client.setQueryData(['tokenBalances', SAFE], BALANCES);
    jest.advanceTimersByTime(2_000);
    expect(mockDisk.has(DISK_KEY)).toBe(false);
  });
});

describe('after a render error', () => {
  it('drops the copy on disk and writes nothing more this launch', () => {
    jest.isolateModules(() => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const fresh = require('@/lib/queryPersistence') as typeof import('@/lib/queryPersistence');
      // The isolated module reads its own copy of the store.
      const { useUserStore: isolatedStore } =
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        require('@/store/useUserStore') as typeof import('@/store/useUserStore');
      isolatedStore.setState({
        users: [{ userId: 'u1', username: 'mark', selected: true } as never],
      });
      const client = newClient();
      running.push(fresh.persistQueryCache(client));
      client.setQueryData(['tokenBalances', SAFE], BALANCES);
      jest.advanceTimersByTime(2_000);
      expect(mockDisk.has(DISK_KEY)).toBe(true);

      fresh.clearPersistedQueryCache();
      expect(mockDisk.has(DISK_KEY)).toBe(false);

      client.setQueryData(['tokenBalances', SAFE], { ...BALANCES, totalUSD: 1 });
      jest.advanceTimersByTime(2_000);
      expect(mockDisk.has(DISK_KEY)).toBe(false);
    });
  });
});
