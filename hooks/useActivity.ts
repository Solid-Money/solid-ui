import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';

import { createActivityEvent, updateActivityEvent } from '@/lib/api';
import { ActivityEvent, TransactionStatus, TransactionType } from '@/lib/types';
import { withRefreshToken } from '@/lib/utils';
import { generateId } from '@/lib/utils/generate-id';
import { getChain } from '@/lib/wagmi';
import { useActivityStore } from '@/store/useActivityStore';
import useUser from './useUser';

// Get explorer URL for a transaction hash based on chain ID
function getExplorerUrl(chainId: number, txHash: string): string {
  const chain = getChain(chainId);
  if (chain?.blockExplorers?.default?.url) {
    return `${chain.blockExplorers.default.url}/tx/${txHash}`;
  }
  // Fallback to Fuse Explorer if chain not found
  return `https://explorer.fuse.io/tx/${txHash}`;
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
  metadata?: {
    description?: string;
    slippage?: string;
    platform?: string;
    tokenAddress?: string;
    [key: string]: any;
  };
}

export function useActivity() {
  const { user } = useUser();
  const { events, storeEvents } = useActivityStore();
  const queryClient = useQueryClient();

  // Get user's activities
  const userActivities = useMemo(() => {
    if (!user?.userId || !events[user.userId]) return [];
    return [...events[user.userId]].sort((a, b) => parseInt(b.timestamp) - parseInt(a.timestamp));
  }, [events, user?.userId]);

  // Get pending activities
  const pendingActivities = useMemo(() => {
    return userActivities.filter(activity =>
      activity.status === TransactionStatus.PENDING ||
      activity.status === TransactionStatus.PROCESSING
    );
  }, [userActivities]);

  // Create new activity and track immediately
  const createActivity = useCallback(async (params: CreateActivityParams): Promise<string> => {
    if (!user?.userId) {
      throw new Error('User not authenticated');
    }

    // Use userOpHash as clientTxId for AA transactions, fall back to generated ID for legacy
    const clientTxId = params.userOpHash || generateId();
    const timestamp = Math.floor(Date.now() / 1000).toString();

    const activityEvent: ActivityEvent = {
      clientTxId,
      title: params.title,
      shortTitle: params.shortTitle,
      timestamp,
      type: params.type,
      status: TransactionStatus.PENDING,
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

    // Store immediately in local state for instant UI feedback
    storeEvents(user.userId, [activityEvent]);

    // Also send to backend immediately using existing API functions
    try {
      await withRefreshToken(() => createActivityEvent(activityEvent));
    } catch (error) {
      console.error('Failed to create activity on server:', error);
      // Don't throw - we want local state to work even if server fails
    }

    // Invalidate queries to trigger refresh
    queryClient.invalidateQueries({ queryKey: ['activity-events', user.userId] });

    return clientTxId;
  }, [user?.userId, storeEvents, queryClient]);

  // Update activity status
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

    const existingActivities = events[user.userId] || [];
    const activityIndex = existingActivities.findIndex(a => a.clientTxId === clientTxId);

    if (activityIndex === -1) return;

    const updatedActivity: ActivityEvent = {
      ...existingActivities[activityIndex],
      ...updates,
      metadata: {
        ...existingActivities[activityIndex].metadata,
        ...updates.metadata,
        updatedAt: new Date().toISOString(),
      },
    };

    const updatedActivities = [...existingActivities];
    updatedActivities[activityIndex] = updatedActivity;

    // Update local state immediately
    storeEvents(user.userId, updatedActivities);

    // Also update on server using existing API functions
    try {
      await withRefreshToken(() => updateActivityEvent(clientTxId, {
        status: updates.status,
        txHash: updates.hash, // Note: API expects 'txHash', not 'hash'
        userOpHash: updates.userOpHash,
        metadata: updates.metadata,
      }));
    } catch (error) {
      console.error('Failed to update activity on server:', error);
      // Don't throw - we want local updates to work even if server fails
    }

    // Invalidate queries to trigger refresh
    queryClient.invalidateQueries({ queryKey: ['activity-events', user.userId] });
  }, [user?.userId, events, storeEvents, queryClient]);

  // Wrapper function to track transactions
  const trackTransaction = useCallback(async <T>(
    params: CreateActivityParams,
    executeTransaction: (onUserOpHash: (userOpHash: `0x${string}`) => void) => Promise<T>
  ): Promise<T> => {
    let clientTxId: string | null = null;

    try {
      // Execute the transaction with callback for immediate userOpHash
      const result = await executeTransaction(async (userOpHash) => {
        // Create activity IMMEDIATELY when we get userOpHash (before waiting for receipt)
        clientTxId = await createActivity({
          ...params,
          userOpHash,
        });
      });

      // If activity wasn't created (no userOpHash callback), create it now
      if (!clientTxId) {
        clientTxId = await createActivity(params);
      }

      // Extract transaction data
      const transaction = result && typeof result === 'object' && 'transaction' in result
        ? (result as any).transaction
        : result;

      // Update with transaction hash when available
      if (transaction && typeof transaction === 'object') {
        const updateData: {
          status: TransactionStatus;
          hash?: string;
          url?: string;
          metadata: Record<string, any>;
        } = {
          status: TransactionStatus.PROCESSING,
          metadata: {
            submittedAt: new Date().toISOString(),
          },
        };

        if ('transactionHash' in transaction) {
          updateData.hash = (transaction as any).transactionHash || (transaction as any).hash;
        }

        if (updateData.hash && params.chainId) {
          updateData.url = getExplorerUrl(params.chainId, updateData.hash);
          updateActivity(clientTxId, updateData);
        }
      }

      return result;
    } catch (error: any) {
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

  // Force refresh activities from server
  const refreshActivities = useCallback(() => {
    if (user?.userId) {
      queryClient.invalidateQueries({ queryKey: ['activity-events', user.userId] });
    }
  }, [user?.userId, queryClient]);

  return {
    activities: userActivities,
    pendingActivities,
    pendingCount: pendingActivities.length,
    createActivity,
    updateActivity,
    trackTransaction,
    refreshActivities,
  };
}