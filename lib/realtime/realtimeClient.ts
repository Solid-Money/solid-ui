import { AppState, AppStateStatus, NativeEventSubscription, Platform } from 'react-native';
import * as Sentry from '@sentry/react-native';
import { QueryClient } from '@tanstack/react-query';
import { io, Socket } from 'socket.io-client';

import { isDummyUserId } from '@/constants/dummyCard';
import { cardBalanceQueryKey, cardDetailsQueryOptions } from '@/hooks/cardDetailsQueryOptions';
import {
  cardTransactionQueryKey,
  cardTransactionsQueryKey,
  spendingHistoryQueryKey,
} from '@/hooks/useCardTransactions';
import { cashbacksQueryKey } from '@/hooks/useCashbacks';
import { fetchActivityEvents, getCardTransactions } from '@/lib/api';
import { CardTransactionsCache, upsertCardTransactions } from '@/lib/realtime/cardTransactionCache';
import { getRealtimeEndpoint } from '@/lib/realtime/endpoint';
import { refreshAccountQueries } from '@/lib/refreshAccountQueries';
import { refreshRewardsAfterSavings } from '@/lib/refreshRewardsAfterSavings';
import {
  ActivityEvent,
  CardTransaction,
  SSEActivityData,
  SSEBalanceUpdateData,
  TransactionType,
} from '@/lib/types';
import { refreshSessionTokens, withRefreshToken } from '@/lib/utils';
import { useActivityStore } from '@/store/useActivityStore';
import { RealtimeStatus, useRealtimeStore } from '@/store/useRealtimeStore';
import { useUserStore } from '@/store/useUserStore';

/** What `RealtimeGateway` pushes for a card transaction Rain or Wirex reported. */
export interface CardTransactionEventData {
  event: 'card_transaction';
  action: 'created' | 'updated';
  userId: string;
  provider: 'rain' | 'wirex' | 'bridge';
  transaction: CardTransaction;
  timestamp: number;
}

// Socket.IO's own reconnection, for a dropped connection.
const RECONNECT_DELAY_MS = 1_000;
const RECONNECT_DELAY_MAX_MS = 30_000;
const CONNECT_TIMEOUT_MS = 20_000;

/**
 * Backoff for a handshake the server refused. Socket.IO does not retry those
 * on its own, so these are ours: quick enough to recover from a deploy, slow
 * enough not to hammer a server that keeps saying no.
 */
const REFUSED_RETRY_DELAYS_MS = [5_000, 15_000, 30_000, 60_000, 120_000];

/**
 * How often the card history is re-read while the socket is down: the
 * fallback the Monday card asks for, and still far less than the 5s polls this
 * replaces. Only runs while the app is in the foreground and something is
 * showing the history.
 */
const FALLBACK_POLL_MS = 60_000;

// Balance refresh debounce, as the SSE stream had it.
const BALANCE_DEBOUNCE_MS = 500;
const BALANCE_DEBOUNCE_DEPOSIT_MS = 200;

/** Card follow-ups (detail re-read, balance, insights) wait for a burst to settle. */
const CARD_FOLLOW_UP_DEBOUNCE_MS = 400;

const GAP_RECOVERY_TIMEOUT_MS = 15_000;

/**
 * Upper bound of the random wait before the card catch-up that follows a
 * dropped connection. A deploy drops every socket at once, they all come back
 * within a second or two, and the card read reaches the issuer's API — so the
 * reads are spread out. Coming back to the app is not delayed: that one is the
 * user waiting to see what they just paid for.
 */
const CATCH_UP_JITTER_MS = 5_000;

const CARD_ACTIVITY_TYPES = new Set<string>([
  TransactionType.CARD_TRANSACTION,
  TransactionType.CARD_WITHDRAWAL,
]);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const isNative = () => Platform.OS === 'ios' || Platform.OS === 'android';

/**
 * Run a callback the socket or a timer invokes. An exception thrown there has
 * nowhere to go — in a release build React Native treats it as fatal — so it is
 * reported and swallowed instead.
 */
const safely = (label: string, fn: () => void) => {
  try {
    fn();
  } catch (error) {
    Sentry.captureException(error, { tags: { type: 'realtime_handler_error', handler: label } });
  }
};

/**
 * The app's one realtime connection: a Socket.IO socket to accounts-service.
 *
 * ## Why a socket, and why only one
 *
 * The SSE stream it replaces is read with `fetch` and a streaming body, which
 * React Native's `fetch` does not have — on iOS and Android the request never
 * resolved, so the app never got a live event there, and Rain and Wirex card
 * purchases were never published to it at all. Socket.IO runs on the platform's
 * own WebSocket on iOS, Android and the web alike, needs no native module, and
 * reconnects by itself. The socket carries everything the stream did plus card
 * transactions, so the app holds one connection, not two.
 *
 * ## Staying correct without it
 *
 * Nothing depends on the socket being up. Whenever it (re)connects the app
 * re-reads the newest activity and card history, so a dropped connection costs
 * freshness, not data; while it is down the card history falls back to a slow
 * poll. On native the socket is closed in the background — the OS would freeze
 * it anyway — and reopened on return, which is when that catch-up runs.
 *
 * ## Re-renders
 *
 * Events are batched per tick and applied as one store write and one cache
 * write; a write that would change nothing is skipped, so a repeated event
 * re-renders nothing. Follow-up reads are debounced, and every one of them is
 * `refetchType: 'active'`, so only what is on screen is fetched.
 *
 * Lives outside React so every screen shares it; `useRealtime` starts and
 * stops it with the signed-in session.
 */
class RealtimeClient {
  private queryClient: QueryClient | null = null;
  private started = false;
  private userId: string | null = null;
  private socket: Socket | null = null;
  private appState: AppStateStatus = 'active';

  private userStoreUnsubscribe: (() => void) | null = null;
  private appStateSubscription: NativeEventSubscription | null = null;
  private fallbackTimer: ReturnType<typeof setInterval> | null = null;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private balanceTimer: ReturnType<typeof setTimeout> | null = null;
  private cardFollowUpTimer: ReturnType<typeof setTimeout> | null = null;

  /** Whether this user's socket has been live before — a later session is a reconnect. */
  private hasBeenLive = false;
  private retryAttempt = 0;
  /** One token refresh per run of refusals, so a bad token cannot loop the refresh. */
  private authRefreshAttempted = false;
  private sessionExpired = false;

  private lastSeq: number | null = null;
  private gapRecoveryInFlight = false;
  private cardCatchUpInFlight = false;

  private pendingActivities: ActivityEvent[] = [];
  private activityFlushScheduled = false;
  /** Latest push per transaction id, until the tick's flush. */
  private pendingCardTransactions = new Map<string, CardTransaction>();
  private cardFlushScheduled = false;
  private cardFollowUpIds = new Set<string>();
  private cardFollowUpCashback = false;
  /** The connection dropped under us (not a return to the app): spread the catch-up. */
  private droppedUnderUs = false;
  private catchUpTimer: ReturnType<typeof setTimeout> | null = null;

  /** Begin following the signed-in user. Idempotent. */
  start(queryClient: QueryClient): void {
    this.queryClient = queryClient;
    if (this.started) {
      this.syncUser();
      return;
    }
    this.started = true;
    this.appState = AppState.currentState ?? 'active';

    this.userStoreUnsubscribe = useUserStore.subscribe(state => {
      const selectedId = state.users.find(user => user.selected)?.userId ?? null;
      if (selectedId !== this.userId) safely('user_change', () => this.syncUser());
    });

    if (isNative()) {
      this.appStateSubscription = AppState.addEventListener('change', next =>
        safely('app_state', () => this.handleAppState(next)),
      );
    }

    this.fallbackTimer = setInterval(
      () => safely('fallback_poll', () => this.fallbackPoll()),
      FALLBACK_POLL_MS,
    );

    this.syncUser();
  }

  /** Stop following anyone: close the socket and drop every listener. */
  stop(): void {
    this.started = false;
    this.userStoreUnsubscribe?.();
    this.userStoreUnsubscribe = null;
    this.appStateSubscription?.remove();
    this.appStateSubscription = null;
    if (this.fallbackTimer) clearInterval(this.fallbackTimer);
    this.fallbackTimer = null;
    this.closeSocket();
    this.resetUserState();
    this.userId = null;
    this.setStatus('idle');
  }

  /** Follow whichever user is selected now. */
  private syncUser(): void {
    const selected = useUserStore.getState().users.find(user => user.selected);
    const nextUserId = selected?.userId ?? null;
    if (nextUserId === this.userId && this.socket) return;

    if (nextUserId !== this.userId) {
      this.closeSocket();
      this.resetUserState();
      this.userId = nextUserId;
    }

    // The development reviewer account has no session on the server.
    if (!this.userId || isDummyUserId(this.userId)) {
      this.setStatus('idle');
      return;
    }
    if (isNative() && this.appState === 'background') return;
    this.openSocket();
  }

  private handleAppState(next: AppStateStatus): void {
    this.appState = next;
    // Only a real trip to the background closes the socket: `inactive` is the
    // notification shade or an incoming-call banner, and reconnecting after
    // each would fetch the catch-up for nothing.
    if (next === 'background') {
      this.closeSocket();
      this.setStatus('idle');
      return;
    }
    // Back in front with no socket — iOS may come back by way of `inactive`,
    // so this keys on the socket rather than on the previous state.
    if (next === 'active' && !this.socket) {
      this.retryAttempt = 0;
      this.authRefreshAttempted = false;
      this.syncUser();
    }
  }

  private openSocket(): void {
    if (this.socket || !this.userId) return;

    const endpoint = getRealtimeEndpoint();
    if (!endpoint) {
      this.setStatus('unavailable');
      return;
    }

    this.setStatus('connecting');
    const socket = io(endpoint.url, {
      path: endpoint.path,
      // No long-polling: the server serves WebSocket only, so a client never
      // needs a sticky session to stay on one pod.
      transports: ['websocket'],
      autoConnect: false,
      reconnection: true,
      reconnectionDelay: RECONNECT_DELAY_MS,
      reconnectionDelayMax: RECONNECT_DELAY_MAX_MS,
      randomizationFactor: 0.5,
      timeout: CONNECT_TIMEOUT_MS,
      // The web is cookie-authenticated; the cookie rides the upgrade request.
      withCredentials: true,
      // Read on every attempt, so a reconnect presents the newest token.
      auth: callback => callback(this.handshakeAuth()),
    });
    this.socket = socket;

    const owns = () => this.socket === socket;

    socket.on('connect', () =>
      safely('connect', () => {
        // Connected, but not live until the server confirms the subscription.
        if (owns()) this.sessionExpired = false;
      }),
    );
    socket.on('session', (payload: unknown) =>
      safely('session', () => {
        if (owns()) this.handleSession(payload);
      }),
    );
    socket.on('session_expired', () =>
      safely('session_expired', () => {
        if (owns()) this.sessionExpired = true;
      }),
    );
    socket.on('disconnect', (reason: Socket.DisconnectReason) =>
      safely('disconnect', () => {
        if (owns()) this.handleDisconnect(socket, reason);
      }),
    );
    socket.on('connect_error', (error: Error) =>
      safely('connect_error', () => {
        if (owns()) this.handleConnectError(socket, error);
      }),
    );
    socket.on('activity', (data: unknown) =>
      safely('activity', () => {
        if (owns()) this.handleActivityEvent(data);
      }),
    );
    socket.on('balance_update', (data: unknown) =>
      safely('balance_update', () => {
        if (owns()) this.handleBalanceUpdateEvent(data);
      }),
    );
    socket.on('card_transaction', (data: unknown) =>
      safely('card_transaction', () => {
        if (owns()) this.handleCardTransactionEvent(data);
      }),
    );

    socket.connect();
  }

  private closeSocket(): void {
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.retryTimer = null;
    // The next session catches up afresh.
    if (this.catchUpTimer) clearTimeout(this.catchUpTimer);
    this.catchUpTimer = null;
    const socket = this.socket;
    this.socket = null;
    if (socket) {
      socket.removeAllListeners();
      socket.disconnect();
    }
    // Anything already received still belongs to this user.
    if (this.pendingActivities.length) this.flushActivities();
    if (this.pendingCardTransactions.size) this.flushCardTransactions();
    this.lastSeq = null;
    this.gapRecoveryInFlight = false;
  }

  private resetUserState(): void {
    this.hasBeenLive = false;
    this.retryAttempt = 0;
    this.authRefreshAttempted = false;
    this.sessionExpired = false;
    this.pendingActivities = [];
    this.pendingCardTransactions.clear();
    this.cardFollowUpIds.clear();
    this.cardFollowUpCashback = false;
    if (this.balanceTimer) clearTimeout(this.balanceTimer);
    this.balanceTimer = null;
    if (this.cardFollowUpTimer) clearTimeout(this.cardFollowUpTimer);
    this.cardFollowUpTimer = null;
    if (this.catchUpTimer) clearTimeout(this.catchUpTimer);
    this.catchUpTimer = null;
    this.droppedUnderUs = false;
  }

  /** Native presents its access token; the web relies on its cookie. */
  private handshakeAuth(): Record<string, string> {
    if (!isNative()) return {};
    const user = useUserStore.getState().users.find(candidate => candidate.selected);
    const token = user?.tokens?.accessToken;
    return token ? { token } : {};
  }

  private handleSession(payload: unknown): void {
    const sessionUserId = isRecord(payload) ? payload.userId : undefined;
    if (sessionUserId !== this.userId) {
      // Authenticated as someone other than the account on screen — e.g. a web
      // cookie left by another login. Its events must not reach this account.
      Sentry.captureMessage('Realtime session for a different user', {
        level: 'warning',
        tags: { type: 'realtime_session_mismatch' },
      });
      this.closeSocket();
      this.setStatus('unavailable');
      return;
    }

    this.retryAttempt = 0;
    this.authRefreshAttempted = false;
    this.setStatus('connected');

    // The first session follows the app's own first reads; any later one may
    // have missed events while it was away.
    if (this.hasBeenLive) this.catchUp(this.droppedUnderUs);
    this.hasBeenLive = true;
    this.droppedUnderUs = false;
  }

  private handleDisconnect(socket: Socket, reason: Socket.DisconnectReason): void {
    this.lastSeq = null;

    if (reason === 'io client disconnect') return;

    if (reason === 'io server disconnect') {
      // The server let go of us — the token expired, or it could not serve the
      // subscription. Socket.IO leaves reconnecting to the client here.
      if (this.sessionExpired) {
        this.sessionExpired = false;
        this.setStatus('connecting');
        this.reauthenticate(socket);
        return;
      }
      this.setStatus('unavailable');
      this.scheduleRetry(socket);
      return;
    }

    // Transport loss or a missed heartbeat: Socket.IO reconnects by itself.
    this.droppedUnderUs = true;
    this.setStatus('connecting');
  }

  private handleConnectError(socket: Socket, error: Error): void {
    // A transport failure (server unreachable, timeout): Socket.IO retries.
    if (socket.active) {
      this.setStatus('connecting');
      return;
    }

    // Refused by the server's handshake check, which Socket.IO never retries.
    if (error?.message === 'unauthorized' && !this.authRefreshAttempted) {
      this.authRefreshAttempted = true;
      this.setStatus('connecting');
      this.reauthenticate(socket);
      return;
    }

    this.setStatus('unavailable');
    this.scheduleRetry(socket);
  }

  /**
   * Try again with a fresh session.
   *
   * Native refreshes it here. The web does not: its session is the cookie the
   * app's own requests renew, and every tab's socket is told its token expired
   * at the same instant. Refreshing from each of them would spend one refresh
   * token several times at once, and the server takes a reused refresh token
   * for a stolen one and signs every session out. So the web only retries,
   * with jitter, and picks up the cookie once a request has renewed it.
   */
  private reauthenticate(socket: Socket): void {
    if (isNative()) {
      void this.refreshThenReconnect(socket);
      return;
    }
    this.scheduleRetry(socket);
  }

  /**
   * Refresh the session, then try again. Shares the app's in-flight refresh,
   * so the socket never races an API call with the same refresh token. A
   * failed refresh is left for the next request the user makes to deal with —
   * the socket does not log anyone out.
   */
  private async refreshThenReconnect(socket: Socket): Promise<void> {
    try {
      await refreshSessionTokens();
    } catch (error) {
      console.warn('[Realtime] Session refresh failed:', error);
    }
    if (this.socket !== socket || socket.connected || socket.active) return;
    socket.connect();
  }

  private scheduleRetry(socket: Socket): void {
    if (this.retryTimer) clearTimeout(this.retryTimer);
    const base =
      REFUSED_RETRY_DELAYS_MS[Math.min(this.retryAttempt, REFUSED_RETRY_DELAYS_MS.length - 1)];
    // ±25%, so sockets the server dropped together do not all return together.
    const delay = Math.round(base * (0.75 + Math.random() * 0.5));
    this.retryAttempt++;
    this.retryTimer = setTimeout(
      () =>
        safely('retry', () => {
          this.retryTimer = null;
          if (this.socket !== socket || socket.connected || socket.active) return;
          this.setStatus('connecting');
          socket.connect();
        }),
      delay,
    );
  }

  private setStatus(status: RealtimeStatus): void {
    useRealtimeStore.getState().setStatus(status);
  }

  // ===========================================================================
  // Catching up
  // ===========================================================================

  private catchUp(spread: boolean): void {
    void this.fetchLatestActivities();

    const run = () =>
      safely('card_catch_up', () => {
        this.catchUpTimer = null;
        void this.catchUpCardTransactions();
        this.scheduleCardFollowUps([]);
      });
    if (this.catchUpTimer) clearTimeout(this.catchUpTimer);
    this.catchUpTimer = null;
    if (spread) {
      this.catchUpTimer = setTimeout(run, Math.random() * CATCH_UP_JITTER_MS);
    } else {
      run();
    }
  }

  /** While the socket is down, keep the card history no staler than a minute. */
  private fallbackPoll(): void {
    if (!this.userId || useRealtimeStore.getState().status === 'connected') return;
    // `background` only: the state can read `unknown` at launch on Android.
    if (isNative() && this.appState === 'background') return;
    if (!isNative() && typeof document !== 'undefined' && document.visibilityState === 'hidden') {
      return;
    }
    const query = this.queryClient
      ?.getQueryCache()
      .find({ queryKey: cardTransactionsQueryKey, exact: true });
    if (!query || query.getObserversCount() === 0) return;
    void this.catchUpCardTransactions();
  }

  /**
   * Re-read the newest page of card history and lay it over the cache. One
   * request, where refetching the infinite query would re-read every page
   * loaded. A cache that never loaded is left for its own first fetch.
   */
  private async catchUpCardTransactions(): Promise<void> {
    const queryClient = this.queryClient;
    const userId = this.userId;
    if (!queryClient || !userId || this.cardCatchUpInFlight) return;
    if (!queryClient.getQueryData<CardTransactionsCache>(cardTransactionsQueryKey)) return;

    this.cardCatchUpInFlight = true;
    try {
      const response = await withRefreshToken(() => getCardTransactions());
      if (this.userId !== userId) return;
      this.applyCardTransactions(Array.isArray(response?.data) ? response.data : []);
    } catch (error) {
      // Non-critical: the next event, poll or pull-to-refresh catches up.
      console.warn('[Realtime] Card history catch-up failed:', error);
    } finally {
      this.cardCatchUpInFlight = false;
    }
  }

  /** The newest page of activity, into the store — as the SSE stream did on reconnect. */
  private async fetchLatestActivities(): Promise<void> {
    const userId = this.userId;
    if (!userId) return;
    try {
      const result = await withRefreshToken(() => fetchActivityEvents(1));
      if (!result?.docs?.length || this.userId !== userId) return;

      const events = result.docs
        .filter(
          (tx: unknown): tx is ActivityEvent =>
            isRecord(tx) &&
            typeof tx.clientTxId === 'string' &&
            typeof tx.type === 'string' &&
            typeof tx.status === 'string',
        )
        .map(tx => this.normalizeActivity(tx));
      if (events.length) useActivityStore.getState().bulkUpsertEvent(userId, events);
    } catch (error) {
      // Non-critical — worst case the user pulls to refresh.
      console.warn('[Realtime] Failed to fetch latest activities:', error);
    }
  }

  // ===========================================================================
  // Card transactions
  // ===========================================================================

  private handleCardTransactionEvent(data: unknown): void {
    if (!this.userId || !isRecord(data)) return;
    const { transaction } = data;
    if (
      data.event !== 'card_transaction' ||
      data.userId !== this.userId ||
      !isRecord(transaction) ||
      typeof transaction.id !== 'string' ||
      !transaction.id
    ) {
      Sentry.captureMessage('Malformed realtime card transaction', {
        level: 'warning',
        tags: { type: 'realtime_malformed_card_transaction' },
      });
      return;
    }

    const card = transaction as unknown as CardTransaction;
    this.pendingCardTransactions.set(card.id, card);
    if (!this.cardFlushScheduled) {
      this.cardFlushScheduled = true;
      queueMicrotask(() => safely('card_flush', () => this.flushCardTransactions()));
    }
  }

  private flushCardTransactions(): void {
    this.cardFlushScheduled = false;
    if (this.pendingCardTransactions.size === 0) return;

    const batch = [...this.pendingCardTransactions.values()];
    this.pendingCardTransactions.clear();

    this.applyCardTransactions(batch);
    this.scheduleCardFollowUps(batch);
  }

  /** One cache write for the whole batch, and none when nothing would change. */
  private applyCardTransactions(transactions: CardTransaction[]): void {
    const queryClient = this.queryClient;
    if (!queryClient || transactions.length === 0) return;
    // Exact key: the insights sit under the same root and have their own shape.
    const cache = queryClient.getQueryData<CardTransactionsCache>(cardTransactionsQueryKey);
    const next = upsertCardTransactions(cache, transactions);
    if (next && next !== cache) queryClient.setQueryData(cardTransactionsQueryKey, next);
  }

  /**
   * What a card change makes stale besides the list row: the detail screen's
   * own read (fees, our ledger), the card balance, this month's insights and,
   * once a purchase settles or is refunded, the cashback. Debounced, and each
   * only re-read if something on screen shows it.
   */
  private scheduleCardFollowUps(transactions: CardTransaction[]): void {
    for (const transaction of transactions) {
      this.cardFollowUpIds.add(transaction.id);
      const status = transaction.status?.toLowerCase();
      if (status === 'settled' || status === 'posted' || transaction.category === 'refund') {
        this.cardFollowUpCashback = true;
      }
    }

    if (this.cardFollowUpTimer) clearTimeout(this.cardFollowUpTimer);
    this.cardFollowUpTimer = setTimeout(
      () => safely('card_follow_ups', () => this.runCardFollowUps()),
      CARD_FOLLOW_UP_DEBOUNCE_MS,
    );
  }

  private runCardFollowUps(): void {
    this.cardFollowUpTimer = null;
    const queryClient = this.queryClient;
    const userId = this.userId;
    const ids = [...this.cardFollowUpIds];
    const cashback = this.cardFollowUpCashback;
    this.cardFollowUpIds.clear();
    this.cardFollowUpCashback = false;
    if (!queryClient || !userId) return;

    const invalidate = (queryKey: unknown[], exact = true) =>
      void queryClient.invalidateQueries({ queryKey, exact }).catch(() => undefined);

    ids.forEach(id => invalidate(cardTransactionQueryKey(id)));
    invalidate(cardBalanceQueryKey(userId));
    invalidate(cardDetailsQueryOptions(userId).queryKey);
    invalidate(spendingHistoryQueryKey, false);
    if (cashback) invalidate(cashbacksQueryKey);
  }

  // ===========================================================================
  // Activity — the payloads, validation and batching the SSE stream had
  // ===========================================================================

  private handleActivityEvent(data: unknown): void {
    if (!this.userId) return;

    if (!isRecord(data)) {
      Sentry.captureMessage('Received malformed realtime activity data', {
        level: 'warning',
        tags: { type: 'realtime_malformed_activity' },
      });
      return;
    }

    const event = data as unknown as SSEActivityData & { seq?: unknown };
    if (event.userId !== undefined && event.userId !== this.userId) return;

    if (!event.event || !['created', 'updated', 'deleted'].includes(event.event)) {
      Sentry.captureMessage('Invalid realtime activity event type', {
        level: 'warning',
        tags: { type: 'realtime_invalid_event_type' },
        extra: { event: event.event },
      });
      return;
    }

    const activity = event.activity;
    if (!isRecord(activity) || typeof activity.clientTxId !== 'string' || !activity.clientTxId) {
      Sentry.captureMessage('Realtime activity missing clientTxId', {
        level: 'warning',
        tags: { type: 'realtime_missing_client_tx_id' },
      });
      return;
    }

    // Deleted events carry a minimal payload (clientTxId + deleted flag only).
    if (
      event.event !== 'deleted' &&
      (typeof activity.type !== 'string' ||
        !activity.type ||
        typeof activity.status !== 'string' ||
        !activity.status)
    ) {
      Sentry.captureMessage('Realtime activity missing type or status', {
        level: 'warning',
        tags: { type: 'realtime_missing_activity_fields' },
      });
      return;
    }

    this.trackSequence(event.seq);

    if (event.event === 'deleted') {
      const deletedAt = activity.deletedAt
        ? new Date(activity.deletedAt)
        : new Date(typeof event.timestamp === 'number' ? event.timestamp : Date.now());
      useActivityStore.getState().markDeleted(this.userId, activity.clientTxId, deletedAt);
      return;
    }

    this.pendingActivities.push(activity);
    if (!this.activityFlushScheduled) {
      this.activityFlushScheduled = true;
      queueMicrotask(() => safely('activity_flush', () => this.flushActivities()));
    }

    // A card deposit or withdrawal moving on changes what the card can spend.
    if (CARD_ACTIVITY_TYPES.has(activity.type)) this.scheduleCardFollowUps([]);
  }

  /** Per-user sequence numbers expose a missed event; re-read the newest page if so. */
  private trackSequence(seq: unknown): void {
    if (typeof seq !== 'number') return;
    if (this.lastSeq !== null && (seq > this.lastSeq + 1 || seq < this.lastSeq)) {
      // A forward gap is a missed event; a regression is a Redis failover that
      // reset the counter. Either way, reconcile against the server.
      this.triggerGapRecovery();
    }
    this.lastSeq = seq;
  }

  private triggerGapRecovery(): void {
    if (this.gapRecoveryInFlight) return;
    this.gapRecoveryInFlight = true;
    const timeout = new Promise<void>((_, reject) =>
      setTimeout(() => reject(new Error('gap recovery timeout')), GAP_RECOVERY_TIMEOUT_MS),
    );
    Promise.race([this.fetchLatestActivities(), timeout])
      .catch(error => console.warn('[Realtime] Gap recovery failed or timed out:', error))
      .finally(() => {
        this.gapRecoveryInFlight = false;
      });
  }

  private flushActivities(): void {
    this.activityFlushScheduled = false;
    const batch = this.pendingActivities;
    this.pendingActivities = [];
    if (!batch.length || !this.userId) return;
    useActivityStore.getState().bulkUpsertEvent(
      this.userId,
      batch.map(activity => this.normalizeActivity(activity)),
    );
  }

  /** The same shape `constructActivity` gives REST rows, so both paths agree. */
  private normalizeActivity(activity: ActivityEvent): ActivityEvent {
    const user = useUserStore.getState().users.find(candidate => candidate.selected);
    return {
      ...activity,
      title: activity.title || `${activity.type} Transaction`,
      timestamp: activity.timestamp || Math.floor(Date.now() / 1000).toString(),
      amount: activity.amount != null ? activity.amount.toString() : '0',
      symbol: activity.symbol || 'USDC',
      fromAddress: activity.fromAddress || user?.safeAddress || '',
    };
  }

  // ===========================================================================
  // Balances
  // ===========================================================================

  private handleBalanceUpdateEvent(data: unknown): void {
    const userId = this.userId;
    if (!userId || !isRecord(data)) return;

    const event = data as unknown as SSEBalanceUpdateData;
    if (!isRecord(event.balance) || event.userId !== userId) return;

    // Debounced, so a burst of balance events refreshes once; deposits sooner.
    const delay =
      event.balance.changeType === 'deposit' ? BALANCE_DEBOUNCE_DEPOSIT_MS : BALANCE_DEBOUNCE_MS;
    if (this.balanceTimer) clearTimeout(this.balanceTimer);
    this.balanceTimer = setTimeout(
      () =>
        safely('balance_refresh', () => {
          this.balanceTimer = null;
          const queryClient = this.queryClient;
          if (!queryClient || this.userId !== userId) return;

          const user = useUserStore.getState().users.find(candidate => candidate.userId === userId);
          if (user?.safeAddress) {
            void refreshAccountQueries(queryClient, userId, user.safeAddress).catch(error =>
              Sentry.captureException(error, { tags: { type: 'realtime_balance_update_error' } }),
            );
          }
          void queryClient
            .invalidateQueries({ queryKey: ['rewards', 'userData', userId] })
            .catch(() => undefined);
          // An incoming transfer may be a cashback payout landing. The feed hides
          // those rows by payout hash (see `lib/utils/cashbackActivity`), and can
          // only do so once the cashback record carries the hash — so refresh the
          // cashbacks with the activity, rather than leaving an unlabelled
          // "Receive soUSD" on screen until something else refetches them.
          if (event.balance.changeType === 'transfer_in') {
            void queryClient
              .invalidateQueries({ queryKey: cashbacksQueryKey })
              .catch(() => undefined);
          }
          // External deposits, withdrawals and share transfers move the savings
          // the rewards screen reports, so refetch it.
          if (
            ['deposit', 'withdrawal', 'transfer_in', 'transfer_out', 'bonus'].includes(
              event.balance.changeType,
            )
          ) {
            refreshRewardsAfterSavings(queryClient, userId, user?.safeAddress);
          }
        }),
      delay,
    );
  }
}

/** The one instance every screen shares. Constructing it touches nothing. */
export const realtimeClient = new RealtimeClient();
