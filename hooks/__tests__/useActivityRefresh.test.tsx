import React from 'react';
import Toast from 'react-native-toast-message';
import { QueryClient, QueryClientProvider, QueryObserver } from '@tanstack/react-query';

import { useActivityRefresh } from '@/hooks/useActivityRefresh';
import { useSyncActivities, useSyncStore } from '@/hooks/useSyncActivities';
import { fetchActivityEvents, syncActivities } from '@/lib/api';
import {
  ActivityEvent,
  ActivityEvents,
  TransactionStatus,
  TransactionType,
  User,
} from '@/lib/types';
import { useAccountRefreshStore } from '@/store/useAccountRefreshStore';
import { useActivityStore } from '@/store/useActivityStore';
import { useUserStore } from '@/store/useUserStore';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { act, create } = require('react-test-renderer');

const mockUser = { userId: 'account', safeAddress: '0xABC', selected: true };
jest.mock('@/hooks/useUser', () => ({ __esModule: true, default: () => ({ user: mockUser }) }));
jest.mock('@/lib/config', () => ({ USER: 'user' }));
jest.mock('@/lib/mmvkStorage', () => ({
  __esModule: true,
  default: () => ({ getItem: () => null, setItem: jest.fn() }),
}));
jest.mock('@/lib/utils', () => ({ withRefreshToken: (fn: () => unknown) => fn() }));
jest.mock('@/lib/api', () => ({
  syncActivities: jest.fn(),
  fetchActivityEvents: jest.fn(),
  fetchActivityEvent: jest.fn(),
}));
jest.mock('react-native-toast-message', () => ({ __esModule: true, default: { show: jest.fn() } }));

const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};
const event: ActivityEvent = {
  clientTxId: 'deposit',
  type: TransactionType.DEPOSIT,
  status: TransactionStatus.PENDING,
  title: 'Deposit',
  timestamp: '123',
  amount: '10',
  symbol: 'USDC',
};
const page = {
  docs: [{ ...event, status: TransactionStatus.SUCCESS }],
  hasNextPage: false,
} as ActivityEvents;
const syncResult = { synced: 1, skipped: 0, errors: 0, message: 'Synced' };

describe('manual account refresh', () => {
  let client: QueryClient;
  let renderer: ReturnType<typeof create>;
  const results: ReturnType<typeof useActivityRefresh>[] = [];
  const background: ReturnType<typeof useSyncActivities>[] = [];
  const unsubscribers: (() => void)[] = [];
  const Probe = ({ slot }: { slot: number }) => {
    const refresh = useActivityRefresh();
    const sync = useSyncActivities({ syncOnMount: false, syncOnAppActive: false });
    React.useEffect(() => {
      results[slot] = refresh;
      background[slot] = sync;
    });
    return null;
  };
  const mount = async () => {
    await act(async () => {
      renderer = create(
        <QueryClientProvider client={client}>
          <Probe slot={0} />
          <Probe slot={1} />
        </QueryClientProvider>,
      );
    });
  };
  const observe = (key: string[], queryFn: () => Promise<unknown>) => {
    const observer = new QueryObserver(client, {
      queryKey: key,
      queryFn,
      initialData: 'old',
      staleTime: Infinity,
    });
    unsubscribers.push(observer.subscribe(() => {}));
  };
  beforeEach(() => {
    jest.clearAllMocks();
    mockUser.selected = true;
    useUserStore.setState({ users: [mockUser as User] });
    useSyncStore.setState({ lastSyncByUser: {}, isSyncingLock: false, syncLockTimestamp: null });
    useAccountRefreshStore.setState({ refreshingByUser: {}, latestPageByUser: {} });
    useActivityStore.setState({ events: { account: [event] } });
    client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
    (syncActivities as jest.Mock).mockResolvedValue(syncResult);
    (fetchActivityEvents as jest.Mock).mockResolvedValue(page);
  });
  afterEach(() => {
    if (renderer) act(() => renderer.unmount());
    unsubscribers.splice(0).forEach(unsubscribe => unsubscribe());
    client.clear();
  });

  it('joins a running backend sync, deduplicates pulls across screens and waits for card history', async () => {
    const sync = deferred<typeof syncResult>();
    const card = deferred<string>();
    (syncActivities as jest.Mock).mockReturnValue(sync.promise);
    const fetchCard = jest.fn(() => card.promise);
    observe(['cardTransactions'], fetchCard);
    await mount();
    let backgroundPromise!: ReturnType<(typeof background)[0]['sync']>;
    let refreshPromise!: Promise<void>;
    await act(async () => {
      backgroundPromise = background[0].sync(undefined, true);
      refreshPromise = results[0].refetchAll();
      expect(results[1].refetchAll()).toBe(refreshPromise);
    });
    expect(syncActivities).toHaveBeenCalledTimes(1);
    expect(fetchActivityEvents).not.toHaveBeenCalled();
    expect(results[0].isRefreshing).toBe(true);
    await act(async () => {
      sync.resolve(syncResult);
      await backgroundPromise;
    });
    expect(fetchActivityEvents).toHaveBeenCalledTimes(1);
    expect(fetchCard).toHaveBeenCalledTimes(1);
    expect(useActivityStore.getState().events.account[0].status).toBe(TransactionStatus.SUCCESS);
    expect(results[1].isRefreshing).toBe(true);
    await act(async () => {
      card.resolve('posted');
      await refreshPromise;
    });
    expect(client.getQueryData(['cardTransactions'])).toBe('posted');
    expect(results[0].isRefreshing).toBe(false);
    expect(Toast.show).not.toHaveBeenCalled();
  });

  it('forces a new server sync even within the automatic cooldown', async () => {
    useSyncStore.setState({ lastSyncByUser: { account: Date.now() } });
    await mount();
    await act(async () => {
      await results[0].refetchAll();
    });
    expect(syncActivities).toHaveBeenCalledTimes(1);
    expect(fetchActivityEvents).toHaveBeenCalledTimes(1);
  });

  it('reloads server rows after sync failure, waits for remaining queries and allows retry', async () => {
    const errorLog = jest.spyOn(console, 'error').mockImplementation(() => {});
    (syncActivities as jest.Mock).mockRejectedValueOnce(new Error('Offline'));
    const balances = deferred<string>();
    observe(['tokenBalances', '0xABC'], () => balances.promise);
    observe(['cardTransactions'], async () => {
      throw new Error('Issuer unavailable');
    });
    await mount();
    let promise!: Promise<void>;
    await act(async () => {
      promise = results[0].refetchAll();
    });
    expect(fetchActivityEvents).toHaveBeenCalledTimes(1);
    expect(results[0].isRefreshing).toBe(true);
    await act(async () => {
      balances.resolve('fresh');
      await promise;
    });
    expect(results[0].isRefreshing).toBe(false);
    expect(Toast.show).toHaveBeenCalledTimes(1);
    await act(async () => {
      await results[0].refetchAll();
    });
    expect(syncActivities).toHaveBeenCalledTimes(2);
    expect(results[0].isRefreshing).toBe(false);
    errorLog.mockRestore();
  });

  it('does not fetch shared caches for an account left during sync', async () => {
    const sync = deferred<typeof syncResult>();
    (syncActivities as jest.Mock).mockReturnValue(sync.promise);
    await mount();
    let promise!: Promise<void>;
    await act(async () => {
      promise = results[0].refetchAll();
    });
    act(() => useUserStore.setState({ users: [] }));
    await act(async () => {
      sync.resolve(syncResult);
      await promise;
    });
    expect(fetchActivityEvents).not.toHaveBeenCalled();
    expect(useAccountRefreshStore.getState().refreshingByUser.account).toBe(false);
  });
});
