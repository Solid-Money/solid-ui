import { useInfiniteQuery } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Hash } from 'viem';

import useUser from '@/hooks/useUser';
import { createActivityEvent, fetchActivityEvents, updateActivityEvent } from '@/lib/api';
import { ActivityEvent, SSEConnectionState, TransactionStatus, TransactionType } from '@/lib/types';
import { withRefreshToken } from '@/lib/utils';
import { generateId } from '@/lib/utils/generate-id';
import { getChain } from '@/lib/wagmi';
import { useActivityStore } from '@/store/useActivityStore';
import { useActivitySSE } from './useActivitySSE';
import { useSyncActivities } from './useSyncActivities';

// Get explorer URL for a transaction hash based on chain ID
function getExplorerUrl(chainId: number, txHash: string): string {
  const chain = getChain(chainId);
  if (chain?.blockExplorers?.default?.url) {
    return `${chain.blockExplorers.default.url}/tx/${txHash}`;
  }
  // Fallback to Fuse Explorer if chain not found
  return `https://explorer.fuse.io/tx/${txHash}`;
}

function getTransactionHash(transaction: any): string {
  if (!transaction || typeof transaction !== 'object') return '';

  if ('transactionHash' in transaction || 'hash' in transaction) {
    return (transaction as any).transactionHash || (transaction as any).hash;
  }

  return '';
}

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
  const { events, bulkUpsertEvent, upsertEvent } = useActivityStore();
  const [cachedActivities, setCachedActivities] = useState<ActivityEvent[]>([]);

  // Real-time activity updates via SSE
  const {
    connectionState: sseConnectionState,
    error: sseError,
    reconnect: sseReconnect,
    lastEventTime: sseLastEventTime,
  } = useActivitySSE({ enabled: !!user?.userId });

  // Sync all activities from backend (handles smart caching internally)
  // Backend now syncs: Blockscout, deposits, bridges, and bank transfers
  const {
    sync: syncFromBackend,
    isSyncing,
    isStale: isSyncStale,
    canSync,
  } = useSyncActivities({
    syncOnAppActive: true,
    syncOnMount: true,
  });

  // Helper to get unique key for event
  const getKey = useCallback((event: ActivityEvent): string => {
    return event.hash || event.userOpHash || event.clientTxId;
  }, []);

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
    enabled: !!user?.userId,
    // Prevent excessive refetches - only refetch when explicitly triggered
    refetchOnMount: false, // Don't refetch when components mount (20+ components use this hook!)
    refetchOnWindowFocus: false, // Don't refetch on window focus
    refetchOnReconnect: false, // Don't refetch on network reconnect
    staleTime: 5 * 60 * 1000, // Consider data fresh for 5 minutes
    gcTime: 5 * 60 * 1000, // Garbage collect after 5 minutes to free memory
    maxPages: 5, // Keep only 5 most recent pages in memory (TanStack Query v5)
    // Query will only refetch when:
    // 1. Explicitly invalidated (by sync success)
    // 2. Manually triggered (pull-to-refresh)
    // 3. Data is older than 5 minutes
  });

  const { data: activityData, isLoading, isRefetching } = activityEvents;

  // Refetch all data sources (backend handles all syncing now)
  // IMPORTANT: Do NOT call refetchActivityEvents() here!
  // syncFromBackend() invalidates the 'activity-events' query on success,
  // which triggers React Query to auto-refetch. Calling both causes double fetches.
  const refetchAll = useCallback(
    (force = false) => {
      if (isSyncing || isRefetching) {
        return;
      }
      // Trigger backend sync - this will:
      // 1. Call /v1/activity/sync API
      // 2. On success, invalidate 'activity-events' query (useSyncActivities.ts:130)
      // 3. React Query auto-refetches the invalidated query
      syncFromBackend(undefined, force).catch((error: any) => {
        console.error('Background sync failed:', error);
      });
    },
    [isSyncing, isRefetching, syncFromBackend],
  );

  // Get user's activities from local storage
  const activities = useMemo(() => {
    if (!user?.userId || !events[user.userId]) return [];
    return [...events[user.userId]]
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
  }, [events, user?.userId]);

  useEffect(() => {
    if (!activities?.length) return;
    setCachedActivities(activities);
  }, [activities, setCachedActivities]);

  // Get pending activities
  const pendingActivities = useMemo(() => {
    return activities.filter(
      activity =>
        activity.status === TransactionStatus.PENDING ||
        activity.status === TransactionStatus.PROCESSING,
    );
  }, [activities]);

  // Sync backend activities to local store for offline access
  useEffect(() => {
    if (!user?.userId || !activityData) return;

    const events = activityData.pages
      .flatMap(page => page?.docs.map(tx => constructActivity(tx, user.safeAddress)))
      .filter((event): event is ActivityEvent => event !== undefined);
    if (!events.length) return;

    bulkUpsertEvent(user.userId, events);
  }, [activityData, user?.userId, user?.safeAddress, bulkUpsertEvent]);

  // Create new activity
  const createActivity = useCallback(
    async (params: CreateActivityParams): Promise<string> => {
      if (!user?.userId) {
        throw new Error('User not authenticated');
      }

      const clientTxId = params.userOpHash || generateId();
      const timestamp = Math.floor(Date.now() / 1000).toString();

      const activityEvent: ActivityEvent = {
        clientTxId,
        title: params.title,
        shortTitle: params.shortTitle,
        timestamp,
        type: params.type,
        status: params.status || TransactionStatus.PENDING,
        amount: params.amount,
        symbol: params.symbol,
        chainId: params.chainId,
        fromAddress: params.fromAddress,
        toAddress: params.toAddress,
        userOpHash: params.userOpHash,
        metadata: {
          description: params.metadata?.description || params.title,
          source: 'transaction-hook',
          ...params.metadata,
        },
      };

      // Update local state immediately for instant UI feedback
      upsertEvent(user.userId, activityEvent);

      // Send to backend for caching (non-blocking)
      withRefreshToken(() => createActivityEvent(activityEvent)).catch(error => {
        console.error('Failed to create activity on server:', error);
      });

      return clientTxId;
    },
    [user?.userId, upsertEvent],
  );

  // Update activity
  const updateActivity = useCallback(
    async (clientTxId: string, updates: UpdateActivityParams) => {
      if (!user?.userId) return;

      const currentState = useActivityStore.getState();
      const existingActivities = currentState.events[user.userId] || [];
      const existing = existingActivities.find(a => a.clientTxId === clientTxId);

      if (!existing) return;

      const updatedActivity: ActivityEvent = {
        ...existing,
        ...updates,
        metadata: {
          ...existing.metadata,
          ...updates.metadata,
          updatedAt: new Date().toISOString(),
        },
      };

      // Update local state immediately
      upsertEvent(user.userId, updatedActivity);

      // Send to backend for caching (non-blocking)
      withRefreshToken(() =>
        updateActivityEvent(clientTxId, {
          status: updates.status,
          txHash: updates.hash,
          userOpHash: updates.userOpHash,
          metadata: updates.metadata,
        }),
      ).catch(error => {
        console.error('Failed to update activity on server:', error);
      });
    },
    [user?.userId, upsertEvent],
  );

  // Wrapper function to track transactions
  const trackTransaction = useCallback(
    async <T>(
      params: CreateActivityParams,
      executeTransaction: (onUserOpHash: (userOpHash: Hash) => void) => Promise<T>,
    ): Promise<T> => {
      let clientTxId: string | null = null;
      const isSuccess = params.status === TransactionStatus.SUCCESS;

      try {
        // Execute the transaction with callback for immediate userOpHash
        const result = await executeTransaction(async userOpHash => {
          // Create activity IMMEDIATELY when we get userOpHash (before waiting for receipt)
          clientTxId = await createActivity({
            ...params,
            userOpHash,
          });
        });

        // Extract transaction data
        const transaction =
          result && typeof result === 'object' && 'transaction' in result
            ? (result as any).transaction
            : result;

        if (isSuccess && !getTransactionHash(transaction)) {
          return result;
        }

        // If activity wasn't created (no userOpHash callback), create it now
        if (!clientTxId) {
          clientTxId = await createActivity(params);
        }

        // Update with transaction hash when available
        if (transaction && typeof transaction === 'object') {
          const updateData: {
            status: TransactionStatus;
            hash?: string;
            url?: string;
            metadata: Record<string, any>;
          } = {
            status: params.status || TransactionStatus.PROCESSING,
            metadata: {
              submittedAt: new Date().toISOString(),
            },
          };

          updateData.hash = getTransactionHash(transaction);

          if (updateData.hash && params.chainId) {
            updateData.url = getExplorerUrl(params.chainId, updateData.hash);
            updateActivity(clientTxId, updateData);
          }
        }

        return result;
      } catch (error: any) {
        if (isSuccess) {
          // If status is success, don't create failed activity
          throw error;
        }

        // If activity was created, update it as failed
        if (clientTxId) {
          updateActivity(clientTxId, {
            status: TransactionStatus.FAILED,
            metadata: {
              error: error?.message || 'Transaction failed',
              failedAt: new Date().toISOString(),
            },
          });
        } else {
          // Create activity to show failure
          const failedClientTxId = await createActivity(params);
          updateActivity(failedClientTxId, {
            status: TransactionStatus.FAILED,
            metadata: {
              error: error?.message || 'Transaction failed',
              failedAt: new Date().toISOString(),
            },
          });
        }

        throw error; // Re-throw to maintain existing error handling
      }
    },
    [createActivity, updateActivity],
  );

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
    // SSE real-time state
    sseConnectionState,
    sseError,
    sseReconnect,
    sseLastEventTime,
  };
}
