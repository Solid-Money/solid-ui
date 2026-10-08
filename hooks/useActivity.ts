import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Hash } from 'viem';
import { base } from 'viem/chains';
import { useShallow } from 'zustand/react/shallow';

import useUser from '@/hooks/useUser';
import { constructActivity } from '@/lib/activityEvents';
import { fetchActivityEvents } from '@/lib/api';
import { ActivityEvent, TransactionStatus, TransactionType } from '@/lib/types';
import { withRefreshToken } from '@/lib/utils';
import { useAccountRefreshStore } from '@/store/useAccountRefreshStore';
import { useActivityStore } from '@/store/useActivityStore';

import { useActivityActions } from './useActivityActions';
import { useActivityRefresh } from './useActivityRefresh';
import { useUserTransactions } from './useAnalytics';
import { isBaseWithdrawRequest, useBaseWithdrawRequests } from './useBaseWithdrawRequests';

export interface CreateActivityParams {
  type: TransactionType;
  /**
   * Use this id instead of generating one. For activities the backend has
   * already created under its own id (a cross-chain send's `sendId`), so the
   * client row and the server row are the same record.
   */
  clientTxId?: string;
  title: string;
  shortTitle?: string;
  amount: string;
  symbol: string;
  chainId?: number;
  fromAddress?: string;
  toAddress?: string;
  userOpHash?: string;
  status?: TransactionStatus;
  metadata?: {
    description?: string;
    slippage?: string;
    platform?: string;
    tokenAddress?: string;
    [key: string]: any;
  };
}

export interface UpdateActivityParams {
  status?: TransactionStatus;
  hash?: string;
  url?: string;
  userOpHash?: string;
  metadata?: Record<string, any>;
}

export type TrackTransaction = <TransactionResult>(
  params: CreateActivityParams,
  executeTransaction: (onUserOpHash: (userOpHash: Hash) => void) => Promise<TransactionResult>,
) => Promise<TransactionResult>;

// Module-level dedup: when multiple components call useActivity() simultaneously,
// only one fetchPage(1) actually hits the network. Others wait for the same promise.
let _initialFetchPromise: Promise<void> | null = null;
let _initialFetchUserId: string | null = null;

export function useActivity() {
  const { user } = useUser();

  // Select only functions (stable references) and current user's events
  const bulkUpsertEvent = useActivityStore(state => state.bulkUpsertEvent);
  // Select only current user's events array to minimize re-renders
  // Using useShallow for array comparison
  const userEventsFromStore = useActivityStore(
    useShallow(state => (user?.userId ? state.events[user.userId] : undefined)),
  );
  const [cachedActivities, setCachedActivities] = useState<ActivityEvent[]>([]);

  // Pagination state (replaces React Query's useInfiniteQuery)
  const [currentPage, setCurrentPage] = useState(1);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [isFetchingNextPage, setIsFetchingNextPage] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const hasFetchedInitial = useRef(false);
  const fetchedForUserId = useRef<string | null>(null);

  const { refetchAll, isRefreshing, isSyncing, isSyncStale, canSync } = useActivityRefresh({
    syncOnAppActive: true,
    syncOnMount: true,
  });

  const { data: userTransactions } = useUserTransactions(user?.safeAddress);

  const withdraws = userTransactions?.withdraws;
  const baseWithdrawRequests = useBaseWithdrawRequests(userEventsFromStore);

  // Fetch a page of activities directly from the API and push to Zustand
  const fetchPage = useCallback(
    async (page: number) => {
      if (!user?.userId) return;
      try {
        const result = await withRefreshToken(() => fetchActivityEvents(page));
        if (!result?.docs) return;

        const events = result.docs
          .filter((tx): tx is ActivityEvent => tx != null)
          .map(tx => constructActivity(tx, user.safeAddress));

        if (events.length) {
          bulkUpsertEvent(user.userId, events);
        }

        setHasNextPage(!!result.hasNextPage);
        setCurrentPage(page);
      } catch (error) {
        console.error('Failed to fetch activity page:', error);
      }
    },
    [user?.userId, user?.safeAddress, bulkUpsertEvent],
  );

  // Initial fetch on mount (page 1 only).
  // Module-level dedup prevents 8+ parallel identical API calls when
  // multiple components using useActivity() mount simultaneously.
  useEffect(() => {
    if (!user?.userId) return;

    // Reset when user switches so the new user gets a fresh fetch
    if (fetchedForUserId.current && fetchedForUserId.current !== user.userId) {
      hasFetchedInitial.current = false;
      setCurrentPage(1);
      setHasNextPage(false);
    }

    if (hasFetchedInitial.current) return;
    hasFetchedInitial.current = true;
    fetchedForUserId.current = user.userId;
    setIsLoading(true);

    // If another instance is already fetching for this user, reuse its promise
    if (_initialFetchUserId === user.userId && _initialFetchPromise) {
      _initialFetchPromise.finally(() => setIsLoading(false));
      return;
    }

    _initialFetchUserId = user.userId;
    const thisPromise = fetchPage(1);
    _initialFetchPromise = thisPromise;
    thisPromise.finally(() => {
      setIsLoading(false);
      // Only clear if this is still the active promise (not replaced by a user switch)
      if (_initialFetchPromise === thisPromise) {
        _initialFetchPromise = null;
      }
    });
  }, [user?.userId, fetchPage]);

  // Load next page
  const fetchNextPage = useCallback(async () => {
    if (!hasNextPage || isFetchingNextPage) return;
    setIsFetchingNextPage(true);
    try {
      await fetchPage(currentPage + 1);
    } finally {
      setIsFetchingNextPage(false);
    }
  }, [hasNextPage, isFetchingNextPage, currentPage, fetchPage]);

  const refreshedPage = useAccountRefreshStore(state =>
    user?.userId ? state.latestPageByUser[user.userId] : undefined,
  );
  useEffect(() => {
    // Keep cached rows visible, but restart server pagination: new rows can
    // shift page boundaries, so the old cursor could otherwise skip history.
    if (!refreshedPage) return;
    setCurrentPage(1);
    setHasNextPage(refreshedPage.hasNextPage);
  }, [refreshedPage]);

  // Get user's activities from local storage
  const activities = useMemo(() => {
    if (!user?.userId || !userEventsFromStore) return [];

    // CRITICAL: Filter out null/corrupted activities FIRST before any map operations
    // This prevents "null is not an object (evaluating 't.type')" errors
    let userEvents = userEventsFromStore.filter(
      (activity): activity is ActivityEvent =>
        activity != null &&
        typeof activity === 'object' &&
        typeof activity.type === 'string' &&
        typeof activity.clientTxId === 'string' &&
        typeof activity.status === 'string',
    );

    // Base withdraw requests are read from the Base queue itself: it has no
    // subgraph. Solved keeps SUCCESS, cancelled is CANCELLED, and a request
    // still in the queue - or not read yet - is PROCESSING. The request id is
    // attached so the activity screen can offer a cancel.
    userEvents = userEvents.map(activity => {
      if (!isBaseWithdrawRequest(activity)) return activity;
      const request = baseWithdrawRequests[activity.hash.toLowerCase()];
      if (!request) return { ...activity, status: TransactionStatus.PROCESSING };
      const withRequestId = { ...activity, requestId: request.requestId };
      if (request.status === 'solved') return withRequestId;
      if (request.status === 'cancelled') {
        return { ...withRequestId, status: TransactionStatus.CANCELLED };
      }
      return { ...withRequestId, status: TransactionStatus.PROCESSING };
    });

    // Cross-reference WITHDRAW activities against the BoringQueue subgraph to
    // show the solver fulfillment status.  The on-chain withdraw request goes
    // through a solver queue — "SUCCESS" on-chain only means the request was
    // submitted, not that the user received USDC.  We show PENDING until the
    // solver marks it as SOLVED, and PROCESSING while the subgraph has the
    // request but hasn't been solved yet.
    //
    // When subgraph data is unavailable we now show PROCESSING (not PENDING)
    // to reflect that the on-chain tx succeeded and the request is in the queue.
    if (withdraws) {
      userEvents = userEvents.map(activity => {
        if (
          activity.type === TransactionType.WITHDRAW &&
          activity.status === TransactionStatus.SUCCESS &&
          activity.chainId !== base.id
        ) {
          const matchingWithdraw = withdraws.find(w => {
            const activityHash = activity.hash?.toLowerCase();
            const activityUserOpHash = activity.userOpHash?.toLowerCase();
            const reqHash = w.requestTxHash?.toLowerCase();
            const solveHash = w.solveTxHash?.toLowerCase();

            if (activityHash && (reqHash === activityHash || solveHash === activityHash)) {
              return true;
            }
            // Also match by userOpHash for AA wallet transactions where the
            // bundled tx hash may differ from what the subgraph indexes.
            if (
              activityUserOpHash &&
              (reqHash === activityUserOpHash || solveHash === activityUserOpHash)
            ) {
              return true;
            }
            return false;
          });

          if (matchingWithdraw?.requestStatus === 'SOLVED') {
            return activity; // Keep SUCCESS
          }
          // Request exists on subgraph but not solved yet → PROCESSING
          if (matchingWithdraw) {
            return { ...activity, status: TransactionStatus.PROCESSING };
          }
          // No matching subgraph entry — the request may not have been indexed
          // yet.  Show PROCESSING rather than PENDING since the on-chain tx
          // already succeeded.
          return { ...activity, status: TransactionStatus.PROCESSING };
        }
        return activity;
      });
    } else {
      // Subgraph data not yet available — show PROCESSING (on-chain tx succeeded,
      // waiting for solver fulfillment) instead of PENDING which implies the
      // user action hasn't been submitted.
      userEvents = userEvents.map(activity => {
        if (
          activity.type === TransactionType.WITHDRAW &&
          activity.status === TransactionStatus.SUCCESS &&
          activity.chainId !== base.id
        ) {
          return { ...activity, status: TransactionStatus.PROCESSING };
        }
        return activity;
      });
    }

    return userEvents
      .filter(activity => {
        // Filter out deleted activities
        if (activity.deleted) return false;
        // Filter out expired direct deposits
        if (
          activity.status === TransactionStatus.FAILED &&
          activity.metadata?.reason === 'expired'
        ) {
          return false;
        }
        return true;
      })
      .sort((a, b) => parseInt(b.timestamp) - parseInt(a.timestamp));
  }, [userEventsFromStore, user?.userId, withdraws, baseWithdrawRequests]);

  useEffect(() => {
    if (!activities?.length) return;
    setCachedActivities(activities);
  }, [activities]);

  // Get pending activities
  const pendingActivities = useMemo(() => {
    return activities.filter(
      activity =>
        activity.status === TransactionStatus.PENDING ||
        activity.status === TransactionStatus.DETECTED ||
        activity.status === TransactionStatus.PROCESSING,
    );
  }, [activities]);

  // Delegate action functions to useActivityActions (subscription-free).
  // Consumers that ONLY need actions should import from '@/hooks/useActivityActions' directly.
  const { createActivity, updateActivity, trackTransaction, getKey } = useActivityActions();

  return {
    activities,
    cachedActivities,
    pendingActivities,
    pendingCount: pendingActivities.length,
    // Pagination (direct fetch, no React Query)
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    getKey,
    createActivity,
    updateActivity,
    trackTransaction,
    refetchAll,
    // Sync state for UI indicators
    isSyncing,
    isRefreshing,
    isSyncStale,
    canSync,
  };
}
