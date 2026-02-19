import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { Hash } from 'viem';
import { useShallow } from 'zustand/react/shallow';

import useDebounce from '@/hooks/useDebounce';
import useUser from '@/hooks/useUser';
import { fetchActivityEvents } from '@/lib/api';
import { ActivityEvent, TransactionStatus, TransactionType } from '@/lib/types';
import { withRefreshToken } from '@/lib/utils';
import { useActivityStore } from '@/store/useActivityStore';

import { useActivityActions } from './useActivityActions';
import { useUserTransactions } from './useAnalytics';
import { useSyncActivities, useSyncStore } from './useSyncActivities';

function constructActivity(tx: ActivityEvent, safeAddress: string): ActivityEvent {
  let clientTxId = `${tx.type}-${tx.timestamp}`;
  if ('trackingId' in tx && tx.trackingId) {
    clientTxId = tx.trackingId as string;
  } else if ('clientTxId' in tx && tx.clientTxId) {
    clientTxId = tx.clientTxId;
  } else if ('hash' in tx && tx.hash) {
    clientTxId = `${tx.type}-${tx.hash}`;
  }

  return {
    ...tx,
    clientTxId,
    title: tx.title || `${tx.type} Transaction`,
    timestamp: tx.timestamp || Math.floor(Date.now() / 1000).toString(),
    amount: tx.amount.toString(),
    symbol: tx.symbol || 'USDC',
    fromAddress: tx.fromAddress || safeAddress,
  };
}

export interface CreateActivityParams {
  type: TransactionType;
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

export function useActivity() {
  const { user } = useUser();
  const queryClient = useQueryClient();
  // Check sync lock SYNCHRONOUSLY to prevent query from fetching during sync
  // This is read during render phase, before effects run
  const isSyncingLock = useSyncStore(state => state.isSyncingLock);

  // Select only functions (stable references) and current user's events
  const bulkUpsertEvent = useActivityStore(state => state.bulkUpsertEvent);
  // Select only current user's events array to minimize re-renders
  // Using useShallow for array comparison
  const userEventsFromStore = useActivityStore(
    useShallow(state => (user?.userId ? state.events[user.userId] : undefined)),
  );
  const [cachedActivities, setCachedActivities] = useState<ActivityEvent[]>([]);

  // Memoize sync options to ensure stable reference
  // (useSyncActivities extracts primitives, but this prevents potential re-render issues)
  const syncOptions = useMemo(
    () => ({
      syncOnAppActive: true,
      syncOnMount: true,
    }),
    [],
  );

  // Sync all activities from backend (handles smart caching internally)
  // Backend now syncs: Blockscout, deposits, bridges, and bank transfers
  const {
    sync: syncFromBackend,
    isSyncing,
    isStale: isSyncStale,
    canSync,
  } = useSyncActivities(syncOptions);

  const { data: userTransactions } = useUserTransactions(user?.safeAddress);

  const transactionsRef = useRef(userTransactions);
  const withdrawsKey = useMemo(() => {
    const withdraws = userTransactions?.withdraws;
    if (!withdraws?.length) return 'empty';
    const hashSample = withdraws
      .slice(0, 3)
      .map(w => `${w.requestTxHash?.slice(0, 10) ?? ''}-${w.requestStatus ?? ''}`)
      .join('|');
    return `${withdraws.length}:${hashSample}`;
  }, [userTransactions?.withdraws]);

  useEffect(() => {
    transactionsRef.current = userTransactions;
  }, [withdrawsKey, userTransactions]);

  // Fetch from backend (single source of truth for all activities)
  const activityEvents = useInfiniteQuery({
    queryKey: ['activity-events', user?.userId],
    queryFn: ({ pageParam = 1 }) => withRefreshToken(() => fetchActivityEvents(pageParam)),
    getNextPageParam: lastPage => {
      if (!lastPage) return undefined;
      if (lastPage.hasNextPage) {
        return lastPage.page + 1;
      }
    },
    initialPageParam: 1,
    // Disable query during sync to prevent bulk refetch of cached pages
    // The UI still shows data from Zustand store while sync is in progress
    enabled: !!user?.userId && !isSyncingLock,
    // Prevent excessive refetches - only refetch when explicitly triggered
    refetchOnMount: false, // Don't refetch when components mount (20+ components use this hook!)
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    staleTime: 5 * 60 * 1000, // Consider data fresh for 5 minutes
    gcTime: 5 * 60 * 1000, // Garbage collect after 5 minutes to free memory
    maxPages: 5, // Keep only 5 most recent pages in memory (TanStack Query v5)
  });

  const { data: activityData, isLoading, isRefetching } = activityEvents;

  const debouncedActivityData = useDebounce(activityData, 1000);

  // Helper to reset infinite query to first page only
  // This prevents React Query from refetching all cached pages
  const resetToFirstPage = useCallback(() => {
    queryClient.setQueryData(['activity-events', user?.userId], (oldData: any) => {
      if (!oldData?.pages?.length) return oldData;
      return {
        pages: oldData.pages.slice(0, 1),
        pageParams: oldData.pageParams.slice(0, 1),
      };
    });
  }, [queryClient, user?.userId]);

  // Refetch all data sources (backend handles all syncing now)
  // IMPORTANT: Do NOT call refetchActivityEvents() here!
  // syncFromBackend() resets to first page before sync starts
  const refetchAll = useCallback(
    (force = false) => {
      if (isSyncing || isRefetching) {
        return;
      }
      // Reset to first page before sync to prevent bulk refetch
      resetToFirstPage();
      // Trigger backend sync
      syncFromBackend(undefined, force).catch((error: any) => {
        console.error('Background sync failed:', error);
      });
    },
    [isSyncing, isRefetching, syncFromBackend, resetToFirstPage],
  );

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

    if (transactionsRef.current?.withdraws) {
      userEvents = userEvents.map(activity => {
        if (
          activity.type === TransactionType.WITHDRAW &&
          activity.status === TransactionStatus.SUCCESS
        ) {
          const matchingWithdraw = transactionsRef.current?.withdraws.find(w => {
            if (
              activity.hash &&
              (w.requestTxHash?.toLowerCase() === activity.hash.toLowerCase() ||
                w.solveTxHash?.toLowerCase() === activity.hash.toLowerCase())
            ) {
              return true;
            }
            return false;
          });

          if (!matchingWithdraw || matchingWithdraw.requestStatus !== 'SOLVED') {
            return { ...activity, status: TransactionStatus.PENDING };
          }
        }
        return activity;
      });
    } else {
      // If subgraph data is not yet available, treat potentially successful withdraws as pending
      // to avoid premature success state (duplication issue)
      userEvents = userEvents.map(activity => {
        if (
          activity.type === TransactionType.WITHDRAW &&
          activity.status === TransactionStatus.SUCCESS
        ) {
          return { ...activity, status: TransactionStatus.PENDING };
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- withdrawsKey is intentional: stable lightweight key replaces unstable object reference
  }, [userEventsFromStore, user?.userId, withdrawsKey]);

  useEffect(() => {
    if (!activities?.length) return;
    setCachedActivities(activities);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- setCachedActivities is stable useState setter
  }, [activities]);

  // Get pending activities
  const pendingActivities = useMemo(() => {
    return activities.filter(
      activity =>
        activity.status === TransactionStatus.PENDING ||
        activity.status === TransactionStatus.PROCESSING,
    );
  }, [activities]);

  // Sync backend activities to local store for offline access
  // Uses debounced activityData to prevent render cascade from maxPages refetches
  // When query re-enables after sync lock, multiple pages may refetch rapidly -
  // debouncing ensures bulkUpsertEvent only fires once after all pages stabilize
  useEffect(() => {
    if (!user?.userId || !debouncedActivityData) return;

    const events = debouncedActivityData.pages
      .flatMap(page => {
        // Guard against undefined/null pages or docs
        if (!page?.docs || !Array.isArray(page.docs)) return [];
        return page.docs
          .filter((tx): tx is ActivityEvent => tx != null)
          .map(tx => constructActivity(tx, user.safeAddress));
      })
      .filter((event): event is ActivityEvent => event != null);
    if (!events.length) return;

    bulkUpsertEvent(user.userId, events);
  }, [debouncedActivityData, user?.userId, user?.safeAddress, bulkUpsertEvent]);

  // Delegate action functions to useActivityActions (subscription-free).
  // Consumers that ONLY need actions should import from '@/hooks/useActivityActions' directly.
  const { createActivity, updateActivity, trackTransaction, getKey } = useActivityActions();

  return {
    activities,
    cachedActivities,
    pendingActivities,
    pendingCount: pendingActivities.length,
    activityEvents,
    isLoading: isLoading || isRefetching,
    getKey,
    createActivity,
    updateActivity,
    trackTransaction,
    refetchAll,
    // Sync state for UI indicators
    isSyncing,
    isSyncStale,
    canSync,
  };
}
