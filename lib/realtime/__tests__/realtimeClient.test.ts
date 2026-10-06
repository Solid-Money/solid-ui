import { AppState, AppStateStatus, Platform } from 'react-native';
import * as Sentry from '@sentry/react-native';
import { QueryClient, QueryObserver } from '@tanstack/react-query';
import { io } from 'socket.io-client';

import { cardTransactionsQueryKey } from '@/hooks/useCardTransactions';
import { fetchActivityEvents, getCardTransactions } from '@/lib/api';
import { CardTransactionsCache } from '@/lib/realtime/cardTransactionCache';
import { realtimeClient } from '@/lib/realtime/realtimeClient';
import {
  CardTransaction,
  CardTransactionCategory,
  TransactionStatus,
  TransactionType,
  User,
} from '@/lib/types';
import { refreshSessionTokens } from '@/lib/utils';
import { useActivityStore } from '@/store/useActivityStore';
import { useRealtimeStore } from '@/store/useRealtimeStore';
import { useUserStore } from '@/store/useUserStore';

jest.mock('socket.io-client', () => {
  type MockListener = (...args: unknown[]) => void;
  class FakeSocket {
    listeners = new Map<string, MockListener[]>();
    connected = false;
    active = false;
    connectCalls = 0;
    url: string;
    options: Record<string, unknown>;
    constructor(url: string, options: Record<string, unknown>) {
      this.url = url;
      this.options = options;
    }
    on(event: string, listener: MockListener) {
      this.listeners.set(event, [...(this.listeners.get(event) ?? []), listener]);
      return this;
    }
    removeAllListeners() {
      this.listeners.clear();
      return this;
    }
    connect() {
      this.connectCalls++;
      this.active = true;
      return this;
    }
    disconnect() {
      this.connected = false;
      this.active = false;
      return this;
    }
    /** What the server (or Socket.IO itself) would emit to the client. */
    serverEmit(event: string, ...args: unknown[]) {
      if (event === 'connect') this.connected = true;
      // As Socket.IO does: `connected` is already false when listeners hear it.
      if (event === 'disconnect') this.connected = false;
      [...(this.listeners.get(event) ?? [])].forEach(listener => listener(...args));
    }
  }
  return {
    io: jest.fn((url: string, options: Record<string, unknown>) => new FakeSocket(url, options)),
  };
});
jest.mock('@sentry/react-native', () => ({
  captureException: jest.fn(),
  captureMessage: jest.fn(),
}));
jest.mock('@/lib/config', () => ({
  USER: 'user',
  EXPO_PUBLIC_FLASH_API_BASE_URL: 'https://accounts.solid.xyz',
}));
jest.mock('@/lib/mmvkStorage', () => ({
  __esModule: true,
  default: () => ({ getItem: () => null, setItem: jest.fn() }),
}));
jest.mock('@/lib/utils', () => ({
  withRefreshToken: (fn: () => unknown) => fn(),
  refreshSessionTokens: jest.fn(),
}));
jest.mock('@/lib/api', () => ({
  fetchActivityEvents: jest.fn(),
  getCardTransactions: jest.fn(),
}));
jest.mock('@/lib/refreshRewardsAfterSavings', () => ({ refreshRewardsAfterSavings: jest.fn() }));

interface FakeSocket {
  url: string;
  options: {
    path: string;
    transports: string[];
    auth: (callback: (data: Record<string, string>) => void) => void;
  };
  connected: boolean;
  active: boolean;
  connectCalls: number;
  serverEmit: (event: string, ...args: unknown[]) => void;
}

const sockets = () => (io as unknown as jest.Mock).mock.results.map(r => r.value as FakeSocket);
const latestSocket = () => sockets()[sockets().length - 1];

const user = {
  userId: 'user-1',
  safeAddress: '0xSAFE',
  selected: true,
  tokens: { accessToken: 'access-1', refreshToken: 'refresh-1' },
} as unknown as User;

const purchase = (id: string, extra: Partial<CardTransaction> = {}) =>
  ({
    id,
    card_account_id: 'card-1',
    customer_id: 'cus-1',
    category: CardTransactionCategory.PURCHASE,
    amount: '11.60',
    currency: 'usd',
    status: 'approved',
    description: '',
    posted_at: '',
    authorized_at: '2026-09-01T10:00:00.000Z',
    related_transaction_ids: [],
    merchant_name: 'Grab',
    ...extra,
  }) as CardTransaction;

const cardEvent = (transaction: CardTransaction, userId = 'user-1') => ({
  event: 'card_transaction',
  action: 'created',
  userId,
  provider: 'rain',
  transaction,
  timestamp: 1,
});

/** Let promise chains and queued microtasks run. */
const flush = async () => {
  for (let i = 0; i < 10; i++) await Promise.resolve();
};

let queryClient: QueryClient;
let appStateHandler: ((state: AppStateStatus) => void) | undefined;

// The store's state is frozen (immer), so its actions are swapped in through
// setState rather than spied on, and put back before every test.
const realActivityActions = {
  bulkUpsertEvent: useActivityStore.getState().bulkUpsertEvent,
  markDeleted: useActivityStore.getState().markDeleted,
};
const mockActivityActions = () => {
  const actions = { bulkUpsertEvent: jest.fn(), markDeleted: jest.fn() };
  useActivityStore.setState(actions);
  return actions;
};
const unsubscribers: (() => void)[] = [];

/** Seed the card history and keep an observer on it, as the activity screen does. */
const seedCardHistory = (rows: CardTransaction[]) => {
  queryClient.setQueryData<CardTransactionsCache>(cardTransactionsQueryKey, {
    pages: [{ data: rows, nextPage: undefined, hasNextPage: false }],
    pageParams: [undefined],
  });
  const observer = new QueryObserver(queryClient, {
    queryKey: cardTransactionsQueryKey,
    queryFn: () => new Promise(() => undefined),
    staleTime: Infinity,
  });
  unsubscribers.push(observer.subscribe(() => undefined));
};
const cachedHistory = () =>
  queryClient.getQueryData<CardTransactionsCache>(cardTransactionsQueryKey);

/** Start, connect, and let the server confirm the session. */
const goLive = () => {
  realtimeClient.start(queryClient);
  const socket = latestSocket();
  socket.serverEmit('connect');
  socket.serverEmit('session', { userId: 'user-1', expiresAt: Date.now() + 3600_000 });
  return socket;
};

beforeEach(() => {
  jest.useFakeTimers({ doNotFake: ['queueMicrotask', 'nextTick'] });
  jest.clearAllMocks();
  appStateHandler = undefined;
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, handler) => {
    appStateHandler = handler as (state: AppStateStatus) => void;
    return { remove: jest.fn() } as ReturnType<typeof AppState.addEventListener>;
  });
  useUserStore.setState({ users: [user] });
  useActivityStore.setState({ events: {}, ...realActivityActions });
  queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  (refreshSessionTokens as jest.Mock).mockResolvedValue(undefined);
  (fetchActivityEvents as jest.Mock).mockResolvedValue({ docs: [] });
  (getCardTransactions as jest.Mock).mockResolvedValue({ data: [] });
});

afterEach(() => {
  realtimeClient.stop();
  unsubscribers.splice(0).forEach(unsubscribe => unsubscribe());
  queryClient.clear();
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe('the realtime client', () => {
  describe('connecting', () => {
    it('opens one websocket to the gateway, presenting the native token', () => {
      realtimeClient.start(queryClient);

      const socket = latestSocket();
      expect(sockets()).toHaveLength(1);
      expect(socket.url).toBe('https://accounts.solid.xyz');
      expect(socket.options.path).toBe('/accounts/v1/socket.io');
      expect(socket.options.transports).toEqual(['websocket']);
      const auth = jest.fn();
      socket.options.auth(auth);
      expect(auth).toHaveBeenCalledWith({ token: 'access-1' });
      expect(useRealtimeStore.getState().status).toBe('connecting');
    });

    it('presents the newest token on every attempt', () => {
      realtimeClient.start(queryClient);
      useUserStore.setState({
        users: [{ ...user, tokens: { accessToken: 'access-2', refreshToken: 'refresh-2' } }],
      });

      const auth = jest.fn();
      latestSocket().options.auth(auth);

      expect(auth).toHaveBeenCalledWith({ token: 'access-2' });
    });

    it('is live only once the server confirms the subscription', () => {
      realtimeClient.start(queryClient);
      const socket = latestSocket();

      socket.serverEmit('connect');
      expect(useRealtimeStore.getState().status).toBe('connecting');

      socket.serverEmit('session', { userId: 'user-1' });
      expect(useRealtimeStore.getState().status).toBe('connected');
    });

    it('refuses a session that is for another account', () => {
      realtimeClient.start(queryClient);
      const socket = latestSocket();
      socket.serverEmit('connect');

      socket.serverEmit('session', { userId: 'someone-else' });

      expect(socket.connected).toBe(false);
      expect(useRealtimeStore.getState().status).toBe('unavailable');
      expect(Sentry.captureMessage).toHaveBeenCalled();
    });

    it('starting twice still holds one connection', () => {
      realtimeClient.start(queryClient);
      realtimeClient.start(queryClient);

      expect(sockets()).toHaveLength(1);
    });
  });

  describe('card transactions', () => {
    it('puts a new purchase into the activity feed as it is pushed', async () => {
      seedCardHistory([purchase('older', { authorized_at: '2026-08-01T10:00:00.000Z' })]);
      const socket = goLive();

      socket.serverEmit('card_transaction', cardEvent(purchase('new')));
      await flush();

      expect(cachedHistory()?.pages[0].data.map(row => row.id)).toEqual(['new', 'older']);
    });

    it('updates a purchase the feed already shows', async () => {
      seedCardHistory([purchase('tx-1')]);
      const socket = goLive();

      socket.serverEmit(
        'card_transaction',
        cardEvent(purchase('tx-1', { status: 'settled', posted_at: '2026-09-02T10:00:00.000Z' })),
      );
      await flush();

      expect(cachedHistory()?.pages[0].data[0].status).toBe('settled');
    });

    it('writes nothing for a push that changes nothing, so the feed does not re-render', async () => {
      seedCardHistory([purchase('tx-1')]);
      const socket = goLive();
      const before = cachedHistory();
      const setQueryData = jest.spyOn(queryClient, 'setQueryData');

      socket.serverEmit('card_transaction', cardEvent(purchase('tx-1')));
      await flush();

      expect(setQueryData).not.toHaveBeenCalled();
      expect(cachedHistory()).toBe(before);
    });

    it('applies a burst as one cache write, latest version of each row winning', async () => {
      seedCardHistory([]);
      const socket = goLive();
      const setQueryData = jest.spyOn(queryClient, 'setQueryData');

      socket.serverEmit('card_transaction', cardEvent(purchase('a')));
      socket.serverEmit('card_transaction', cardEvent(purchase('b')));
      socket.serverEmit('card_transaction', cardEvent(purchase('a', { status: 'declined' })));
      await flush();

      expect(setQueryData).toHaveBeenCalledTimes(1);
      const rows = cachedHistory()?.pages[0].data ?? [];
      expect(rows).toHaveLength(2);
      expect(rows.find(row => row.id === 'a')?.status).toBe('declined');
    });

    it("ignores another user's event and a malformed one", async () => {
      seedCardHistory([]);
      const socket = goLive();

      socket.serverEmit('card_transaction', cardEvent(purchase('x'), 'someone-else'));
      socket.serverEmit('card_transaction', { event: 'card_transaction', userId: 'user-1' });
      socket.serverEmit('card_transaction', null);
      await flush();

      expect(cachedHistory()?.pages[0].data).toEqual([]);
    });

    it('then re-reads the detail screen and card balance, once, after the burst', async () => {
      seedCardHistory([]);
      const socket = goLive();
      const invalidate = jest.spyOn(queryClient, 'invalidateQueries');

      socket.serverEmit('card_transaction', cardEvent(purchase('a')));
      socket.serverEmit('card_transaction', cardEvent(purchase('b')));
      await flush();
      expect(invalidate).not.toHaveBeenCalled();

      jest.advanceTimersByTime(400);

      const keys = invalidate.mock.calls.map(([filters]) => filters?.queryKey);
      expect(keys).toEqual(
        expect.arrayContaining([
          ['card-transaction', 'a'],
          ['card-transaction', 'b'],
          ['cardBalance', 'user-1'],
          ['cardDetails', 'user-1'],
          ['cardTransactions', 'insights'],
        ]),
      );
      // Never the list itself: the push already updated it, and invalidating it
      // would re-read every page the user has loaded.
      expect(invalidate.mock.calls.some(([filters]) => filters?.queryKey?.length === 1)).toBe(
        false,
      );
    });

    it('re-reads the cashback once a purchase settles', async () => {
      seedCardHistory([]);
      const socket = goLive();
      const invalidate = jest.spyOn(queryClient, 'invalidateQueries');

      socket.serverEmit('card_transaction', cardEvent(purchase('a', { status: 'settled' })));
      await flush();
      jest.advanceTimersByTime(400);

      expect(invalidate.mock.calls.map(([filters]) => filters?.queryKey)).toContainEqual([
        'cashbacks',
      ]);
    });
  });

  describe('activity', () => {
    const activityEvent = (clientTxId: string, seq?: number) => ({
      event: 'updated',
      userId: 'user-1',
      activity: {
        clientTxId,
        type: TransactionType.DEPOSIT,
        status: TransactionStatus.SUCCESS,
        title: 'Deposit',
        amount: 10,
        timestamp: '100',
      },
      timestamp: 1,
      ...(seq !== undefined && { seq }),
    });

    it('applies a burst of activity in one store write', async () => {
      const socket = goLive();
      const { bulkUpsertEvent: bulkUpsert } = mockActivityActions();

      socket.serverEmit('activity', activityEvent('tx-1'));
      socket.serverEmit('activity', activityEvent('tx-2'));
      await flush();

      expect(bulkUpsert).toHaveBeenCalledTimes(1);
      const [, events] = bulkUpsert.mock.calls[0] as [
        string,
        { clientTxId: string; amount: string }[],
      ];
      expect(events.map(event => event.clientTxId)).toEqual(['tx-1', 'tx-2']);
      // Normalised as the REST path normalises.
      expect(events[0].amount).toBe('10');
    });

    it('marks a deleted activity deleted', () => {
      const socket = goLive();
      const { markDeleted } = mockActivityActions();

      socket.serverEmit('activity', {
        event: 'deleted',
        userId: 'user-1',
        activity: { clientTxId: 'tx-9', deleted: true },
        timestamp: 1,
      });

      expect(markDeleted).toHaveBeenCalledWith('user-1', 'tx-9', expect.any(Date));
    });

    it('re-reads the newest activity when a sequence number is skipped', async () => {
      const socket = goLive();

      socket.serverEmit('activity', activityEvent('tx-1', 1));
      socket.serverEmit('activity', activityEvent('tx-3', 3));
      await flush();

      expect(fetchActivityEvents).toHaveBeenCalledWith(1);
    });

    it('survives a handler that throws', () => {
      const socket = goLive();
      mockActivityActions().markDeleted.mockImplementation(() => {
        throw new Error('store exploded');
      });

      expect(() =>
        socket.serverEmit('activity', {
          event: 'deleted',
          userId: 'user-1',
          activity: { clientTxId: 'tx-9' },
          timestamp: 1,
        }),
      ).not.toThrow();
      expect(Sentry.captureException).toHaveBeenCalled();
    });
  });

  describe('reconnecting', () => {
    it('catches up on a reconnect, but not on the first session', async () => {
      seedCardHistory([]);
      const socket = goLive();
      await flush();
      expect(fetchActivityEvents).not.toHaveBeenCalled();
      expect(getCardTransactions).not.toHaveBeenCalled();

      (getCardTransactions as jest.Mock).mockResolvedValue({ data: [purchase('missed')] });
      socket.serverEmit('disconnect', 'transport close');
      expect(useRealtimeStore.getState().status).toBe('connecting');
      socket.serverEmit('connect');
      socket.serverEmit('session', { userId: 'user-1' });
      await flush();
      expect(fetchActivityEvents).toHaveBeenCalledWith(1);

      // A dropped connection spreads its card read — a deploy drops everyone at once.
      jest.advanceTimersByTime(5_000);
      await flush();
      expect(getCardTransactions).toHaveBeenCalledTimes(1);
      expect(cachedHistory()?.pages[0].data.map(row => row.id)).toEqual(['missed']);
    });

    it('catches up at once on returning to the app, where the user is waiting for it', async () => {
      seedCardHistory([]);
      goLive();
      (getCardTransactions as jest.Mock).mockResolvedValue({ data: [purchase('paid-meanwhile')] });

      appStateHandler?.('background');
      appStateHandler?.('active');
      const returned = latestSocket();
      returned.serverEmit('connect');
      returned.serverEmit('session', { userId: 'user-1' });
      await flush();

      expect(getCardTransactions).toHaveBeenCalledTimes(1);
      expect(cachedHistory()?.pages[0].data.map(row => row.id)).toEqual(['paid-meanwhile']);
    });

    it('refreshes the session once when the handshake is refused for the token', async () => {
      realtimeClient.start(queryClient);
      const socket = latestSocket();

      socket.active = false;
      socket.serverEmit('connect_error', new Error('unauthorized'));
      await flush();

      expect(refreshSessionTokens).toHaveBeenCalledTimes(1);
      expect(socket.connectCalls).toBe(2);

      // Refused again: no second refresh, just a slower retry.
      socket.active = false;
      socket.serverEmit('connect_error', new Error('unauthorized'));
      await flush();

      expect(refreshSessionTokens).toHaveBeenCalledTimes(1);
      expect(useRealtimeStore.getState().status).toBe('unavailable');
      // The first refused retry is 5s ±25%.
      jest.advanceTimersByTime(6_250);
      expect(socket.connectCalls).toBe(3);
    });

    it('leaves a transport failure to Socket.IO’s own reconnection', () => {
      realtimeClient.start(queryClient);
      const socket = latestSocket();

      socket.active = true;
      socket.serverEmit('connect_error', new Error('websocket error'));

      expect(refreshSessionTokens).not.toHaveBeenCalled();
      expect(socket.connectCalls).toBe(1);
      expect(useRealtimeStore.getState().status).toBe('connecting');
    });

    it('reconnects with a fresh token when the server ends an expired session', async () => {
      const socket = goLive();

      socket.serverEmit('session_expired', {});
      socket.active = false;
      socket.serverEmit('disconnect', 'io server disconnect');
      await flush();

      expect(refreshSessionTokens).toHaveBeenCalledTimes(1);
      expect(socket.connectCalls).toBe(2);
    });

    it('backs off when the server drops it for any other reason', () => {
      const socket = goLive();

      socket.active = false;
      socket.serverEmit('disconnect', 'io server disconnect');

      expect(useRealtimeStore.getState().status).toBe('unavailable');
      expect(socket.connectCalls).toBe(1);
      // The first refused retry is 5s ±25%.
      jest.advanceTimersByTime(6_250);
      expect(socket.connectCalls).toBe(2);
    });
  });

  describe('on the web', () => {
    beforeEach(() => {
      jest.replaceProperty(Platform, 'OS', 'web');
    });

    it('sends no token — the session cookie rides the upgrade request', () => {
      realtimeClient.start(queryClient);

      const auth = jest.fn();
      latestSocket().options.auth(auth);

      expect(auth).toHaveBeenCalledWith({});
    });

    it('never refreshes the session itself, so tabs cannot spend one refresh token twice', async () => {
      const socket = goLive();

      // Every tab is told at once that the cookie's token expired.
      socket.serverEmit('session_expired', {});
      socket.active = false;
      socket.serverEmit('disconnect', 'io server disconnect');
      await flush();

      expect(refreshSessionTokens).not.toHaveBeenCalled();
      expect(socket.connectCalls).toBe(1);

      // It retries the handshake, once the app's own requests have renewed the cookie.
      jest.advanceTimersByTime(6_250);
      expect(socket.connectCalls).toBe(2);
      expect(refreshSessionTokens).not.toHaveBeenCalled();
    });

    it('answers a refused handshake with a retry, not a refresh', async () => {
      realtimeClient.start(queryClient);
      const socket = latestSocket();

      socket.active = false;
      socket.serverEmit('connect_error', new Error('unauthorized'));
      await flush();

      expect(refreshSessionTokens).not.toHaveBeenCalled();
      jest.advanceTimersByTime(6_250);
      expect(socket.connectCalls).toBe(2);
    });
  });

  describe('the app lifecycle', () => {
    it('closes the socket in the background and opens a new one on return', () => {
      const first = goLive();

      appStateHandler?.('background');
      expect(first.connected).toBe(false);
      expect(useRealtimeStore.getState().status).toBe('idle');

      appStateHandler?.('active');
      expect(sockets()).toHaveLength(2);
    });

    it('keeps the socket through a transient inactive state', () => {
      goLive();

      appStateHandler?.('inactive');
      appStateHandler?.('active');

      expect(sockets()).toHaveLength(1);
      expect(useRealtimeStore.getState().status).toBe('connected');
    });

    it('follows a switch to another account', () => {
      const first = goLive();

      useUserStore.setState({
        users: [
          { ...user, selected: false },
          { ...user, userId: 'user-2', selected: true },
        ],
      });

      expect(first.connected).toBe(false);
      expect(sockets()).toHaveLength(2);
    });

    it('stops completely without a session', () => {
      const socket = goLive();

      realtimeClient.stop();

      expect(socket.connected).toBe(false);
      expect(useRealtimeStore.getState().status).toBe('idle');
    });
  });

  describe('without the socket', () => {
    it('re-reads the card history once a minute while it is on screen', async () => {
      seedCardHistory([]);
      realtimeClient.start(queryClient);
      latestSocket().serverEmit('connect_error', new Error('websocket error'));

      jest.advanceTimersByTime(60_000);
      await flush();

      expect(getCardTransactions).toHaveBeenCalledTimes(1);
    });

    it('does not poll while live', async () => {
      seedCardHistory([]);
      goLive();

      jest.advanceTimersByTime(180_000);
      await flush();

      expect(getCardTransactions).not.toHaveBeenCalled();
    });

    it('does not poll for a history nothing is showing', async () => {
      realtimeClient.start(queryClient);

      jest.advanceTimersByTime(60_000);
      await flush();

      expect(getCardTransactions).not.toHaveBeenCalled();
    });
  });
});
