import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo } from 'react';
import { Hash } from 'viem';
import { mainnet } from 'viem/chains';
import { useBlockNumber } from 'wagmi';

import { useGetUserTransactionsQuery } from '@/graphql/generated/user-info';
import {
  formatTransactions,
  useBankTransferTransactions,
  useBridgeDepositTransactions,
  useSendTransactions,
} from '@/hooks/useAnalytics';
import useUser from '@/hooks/useUser';
import { createActivityEvent, fetchActivityEvents, updateActivityEvent } from '@/lib/api';
import { ActivityEvent, TransactionStatus, TransactionType } from '@/lib/types';
import { withRefreshToken } from '@/lib/utils';
import { generateId } from '@/lib/utils/generate-id';
import { getChain } from '@/lib/wagmi';
import { useActivityStore } from '@/store/useActivityStore';

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

export type TrackTransaction = <TransactionResult>(params: CreateActivityParams, executeTransaction: (onUserOpHash: (userOpHash: Hash) => void) => Promise<TransactionResult>) => Promise<TransactionResult>

export function useActivity() {
  const { user } = useUser();
  const { events, upsertEvent, setEvents } = useActivityStore();

  const { data: blockNumber } = useBlockNumber({
    watch: true,
    chainId: mainnet.id,
  });

  // Helper to get unique key for event
  const getKey = useCallback((event: ActivityEvent): string => {
    return event.hash || event.userOpHash || event.clientTxId;
  }, []);

  // 1. Fetch from backend first (cached data for instant display)
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
  });

  const { data: activityData, refetch: refetchActivityEvents } = activityEvents;

  // 2. Fetch from third-party services
  const { data: userDepositTransactions, refetch: refetchTransactions } =
    useGetUserTransactionsQuery({
      variables: {
        address: user?.safeAddress?.toLowerCase() ?? '',
      },
    });

  const { data: sendTransactions, refetch: refetchSendTransactions } = useSendTransactions(
    user?.safeAddress ?? '',
  );

  const { data: bridgeDepositTransactions, refetch: refetchBridgeDepositTransactions } =
    useBridgeDepositTransactions(user?.safeAddress ?? '');

  const { data: bankTransferTransactions, refetch: refetchBankTransfers } =
    useBankTransferTransactions();

  // 3. Format third-party transactions
  const { data: transactions } = useQuery({
    queryKey: [
      'formatted-transactions',
      user?.safeAddress,
      userDepositTransactions?.deposits?.length,
      sendTransactions?.fuse?.length,
      sendTransactions?.ethereum?.length,
      bridgeDepositTransactions?.length,
      bankTransferTransactions?.length,
    ],
    queryFn: () =>
      formatTransactions(
        userDepositTransactions,
        sendTransactions,
        bridgeDepositTransactions,
        bankTransferTransactions,
      ),
  });

  // Refetch all data sources
  const refetchAll = useCallback(() => {
    refetchActivityEvents();
    refetchTransactions();
    refetchSendTransactions();
    refetchBridgeDepositTransactions();
    refetchBankTransfers();
  }, [refetchActivityEvents, refetchTransactions, refetchSendTransactions, refetchBridgeDepositTransactions, refetchBankTransfers]);

  // Get user's activities
  const activities = useMemo(() => {
    if (!user?.userId || !events[user.userId]) return [];
    return [...events[user.userId]].sort((a, b) => parseInt(b.timestamp) - parseInt(a.timestamp));
  }, [events, user?.userId]);

  // Get pending activities
  const pendingActivities = useMemo(() => {
    return activities.filter(activity =>
      activity.status === TransactionStatus.PENDING ||
      activity.status === TransactionStatus.PROCESSING
    );
  }, [activities]);

  // 4. Sync third-party transactions to backend (create new + update status changes)
  useEffect(() => {
    if (!user?.userId || !transactions?.length) return;

    const serverEvents = activityData?.pages.flatMap(page => page?.docs || []) || [];

    transactions.forEach(tx => {
      if (!tx.hash) return;

      const existingLocal = activities.find(e => getKey(e) === tx.hash);
      const existingServer = serverEvents.find(e => getKey(e) === tx.hash);

      // Check if transaction exists anywhere
      if (!existingServer && !existingLocal) {
        // New transaction - create it
        withRefreshToken(() =>
          createActivityEvent({
            clientTxId: `${tx.type}-${tx.hash}`,
            title: tx.title || `${tx.type} Transaction`,
            timestamp: tx.timestamp,
            type: tx.type,
            status: tx.status,
            amount: tx.amount.toString(),
            symbol: tx.symbol || 'USDC',
            chainId: tx.chainId,
            fromAddress: tx.fromAddress || user.safeAddress,
            toAddress: tx.toAddress,
            hash: tx.hash,
            url: tx.url,
            metadata: {
              description: tx.title || `External ${tx.type} transaction`,
              source: 'external-sync',
            },
          }),
        ).catch(error => console.error(`Failed to create transaction ${tx.hash}:`, error));
      } else if (existingLocal || existingServer) {
        // Transaction exists - check if status changed to final state
        const existing = existingLocal || existingServer;
        if (!existing) {
          console.warn(`Transaction ${tx.hash} not found`);
          return;
        }

        const isPending = existing.status === TransactionStatus.PENDING || existing.status === TransactionStatus.PROCESSING;
        const isFinal = tx.status === TransactionStatus.SUCCESS || tx.status === TransactionStatus.FAILED;

        if (isPending && isFinal && existing.status !== tx.status) {
          // Status changed from pending to final - update it
          withRefreshToken(() =>
            updateActivityEvent(existing.clientTxId, {
              status: tx.status,
              metadata: {
                ...existing.metadata,
                updatedAt: new Date().toISOString(),
                source: 'external-sync',
              },
            }),
          ).catch(error => console.error(`Failed to update transaction ${tx.hash}:`, error));
        }
      }
    });
  }, [transactions, activityData, activities, user?.userId, user?.safeAddress]);

  // 5. Merge backend + local data (simple deduplication)
  const allEvents = useMemo(() => {
    const serverEvents = activityData?.pages.flatMap(page => page?.docs || []) || [];
    const seen = new Map<string, ActivityEvent>();

    // Server events first (source of truth)
    serverEvents.forEach(event => {
      const key = getKey(event);
      if (key && !seen.has(key)) {
        seen.set(key, event);
      }
    });

    // Local events (for pending/immediate feedback)
    activities.forEach(event => {
      const key = getKey(event);
      if (!key) return;

      const existing = seen.get(key);
      // Prefer server version if confirmed, otherwise use local
      if (!existing || (existing.status === TransactionStatus.PENDING && event.status !== TransactionStatus.PENDING)) {
        seen.set(key, event);
      }
    });

    return Array.from(seen.values()).sort((a, b) => parseInt(b.timestamp) - parseInt(a.timestamp));
  }, [activityData, activities]);

  // Sync confirmed server events to local store
  useEffect(() => {
    if (!user?.userId || !activityData?.pages.length) return;

    const serverEvents = activityData.pages.flatMap(page => page?.docs || []);
    const confirmedEvents = serverEvents.filter(
      e => e.status === TransactionStatus.SUCCESS || e.status === TransactionStatus.FAILED
    );

    if (confirmedEvents.length) {
      setEvents(user.userId, confirmedEvents);
    }
  }, [activityData, user?.userId, setEvents]);

  // Create new activity
  const createActivity = useCallback(async (params: CreateActivityParams): Promise<string> => {
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
  }, [user?.userId, upsertEvent]);

  // Update activity
  const updateActivity = useCallback(async (
    clientTxId: string,
    updates: {
      status?: TransactionStatus;
      hash?: string;
      url?: string;
      userOpHash?: string;
      metadata?: Record<string, any>;
    }
  ) => {
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
    withRefreshToken(() => updateActivityEvent(clientTxId, {
      status: updates.status,
      txHash: updates.hash,
      userOpHash: updates.userOpHash,
      metadata: updates.metadata,
    })).catch(error => {
      console.error('Failed to update activity on server:', error);
    });
  }, [user?.userId, upsertEvent]);

  // Wrapper function to track transactions
  const trackTransaction = useCallback(async <T>(
    params: CreateActivityParams,
    executeTransaction: (onUserOpHash: (userOpHash: Hash) => void) => Promise<T>,
  ): Promise<T> => {
    let clientTxId: string | null = null;
    const isSuccess = params.status === TransactionStatus.SUCCESS;

    try {
      // Execute the transaction with callback for immediate userOpHash
      const result = await executeTransaction(async (userOpHash) => {
        // Create activity IMMEDIATELY when we get userOpHash (before waiting for receipt)
        clientTxId = await createActivity({
          ...params,
          userOpHash,
        });
      });

      // Extract transaction data
      const transaction = result && typeof result === 'object' && 'transaction' in result
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
  }, [createActivity, updateActivity]);

  useEffect(() => {
    if (pendingActivities.length === 0) return;

    const interval = setInterval(refetchAll, 3000);

    return () => clearInterval(interval);
  }, [blockNumber, refetchAll]);

  return {
    activities,
    pendingActivities,
    pendingCount: pendingActivities.length,
    activityEvents,
    allEvents,
    getKey,
    createActivity,
    updateActivity,
    trackTransaction,
    refetchAll,
  };
}
