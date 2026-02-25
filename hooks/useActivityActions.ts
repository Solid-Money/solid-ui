import { useCallback, useMemo } from 'react';
import { Hash } from 'viem';

import { createActivityEvent, updateActivityEvent } from '@/lib/api';
import { USER_CANCELLED_TRANSACTION } from '@/lib/execute';
import { ActivityEvent, TransactionStatus, User } from '@/lib/types';
import { withRefreshToken } from '@/lib/utils';
import { generateId } from '@/lib/utils/generate-id';
import { getChain } from '@/lib/wagmi';
import { useActivityStore } from '@/store/useActivityStore';
import { useUserStore } from '@/store/useUserStore';

import type { CreateActivityParams, UpdateActivityParams } from './useActivity';

// ---------------------------------------------------------------------------
// Pure helpers (no React, no store)
// ---------------------------------------------------------------------------

function getExplorerUrl(chainId: number, txHash: string): string {
  const chain = getChain(chainId);
  if (chain?.blockExplorers?.default?.url) {
    return `${chain.blockExplorers.default.url}/tx/${txHash}`;
  }
  return `https://explorer.fuse.io/tx/${txHash}`;
}

function getTransactionHash(transaction: any): string {
  if (!transaction || typeof transaction !== 'object') return '';
  if ('transactionHash' in transaction || 'hash' in transaction) {
    return (transaction as any).transactionHash || (transaction as any).hash;
  }
  return '';
}

// ---------------------------------------------------------------------------
// Helper to get the currently-selected user from the store snapshot.
// Called inside callbacks (NOT during render) so it never creates a
// Zustand subscription.
// ---------------------------------------------------------------------------

function getSelectedUser(): User | undefined {
  const { users } = useUserStore.getState();
  return users.find((u: User) => u.selected);
}

// ---------------------------------------------------------------------------
// useActivityActions -- action-only hook (no store subscription, no re-renders
// when activity data changes).
//
// Consumers that only need createActivity / updateActivity / trackTransaction
// / getKey should use this hook instead of useActivity() to avoid unnecessary
// re-renders from the activity store.
// ---------------------------------------------------------------------------

export function useActivityActions() {
  const TERMINAL_STATUSES = useMemo(
    () =>
      new Set([TransactionStatus.SUCCESS, TransactionStatus.FAILED, TransactionStatus.REFUNDED]),
    [],
  );

  const getKey = useCallback((event: ActivityEvent): string => {
    return event.hash || event.userOpHash || event.clientTxId;
  }, []);

  const createActivity = useCallback(
    async (params: CreateActivityParams): Promise<string> => {
      const user = getSelectedUser();
      if (!user?.userId) {
        throw new Error('User not authenticated');
      }

      const upsertEvent = useActivityStore.getState().upsertEvent;

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
    [],
  );

  const updateActivity = useCallback(
    async (clientTxId: string, updates: UpdateActivityParams) => {
      const user = getSelectedUser();
      if (!user?.userId) return;

      const currentState = useActivityStore.getState();
      const upsertEvent = currentState.upsertEvent;
      const existingActivities = currentState.events[user.userId] || [];
      const existing = existingActivities.find(a => a.clientTxId === clientTxId);

      if (!existing) return;

      // Guard: SUCCESS is the highest-priority status. Once an activity
      // reaches SUCCESS, no other status can overwrite it — this prevents
      // stale .catch() handlers or backend race conditions from flipping
      // a successful transaction to FAILED.
      const isSuccessProtected =
        existing.status === TransactionStatus.SUCCESS &&
        updates.status !== undefined &&
        updates.status !== TransactionStatus.SUCCESS;

      // Guard: do not optimistically downgrade a terminal status to
      // a non-terminal one (e.g. FAILED → PENDING).
      const isTerminalDowngrade =
        TERMINAL_STATUSES.has(existing.status) &&
        updates.status !== undefined &&
        !TERMINAL_STATUSES.has(updates.status);

      const shouldBlockStatus = isSuccessProtected || isTerminalDowngrade;

      if (!shouldBlockStatus) {
        const updatedActivity: ActivityEvent = {
          ...existing,
          ...updates,
          metadata: {
            ...existing.metadata,
            ...updates.metadata,
            updatedAt: new Date().toISOString(),
          },
        };

        upsertEvent(user.userId, updatedActivity);
      }

      // Send to backend, but strip the status field when it would be a
      // downgrade — the backend has no status-transition guards.
      const backendStatus = shouldBlockStatus ? undefined : updates.status;
      withRefreshToken(() =>
        updateActivityEvent(clientTxId, {
          status: backendStatus,
          txHash: updates.hash,
          userOpHash: updates.userOpHash,
          metadata: updates.metadata,
        }),
      ).catch(error => {
        console.error('Failed to update activity on server:', error);
      });
    },
    [TERMINAL_STATUSES],
  );

  const trackTransaction = useCallback(
    async <T>(
      params: CreateActivityParams,
      executeTransaction: (onUserOpHash: (userOpHash: Hash) => void) => Promise<T>,
    ): Promise<T> => {
      let clientTxId: string | null = null;
      const isSuccess = params.status === TransactionStatus.SUCCESS;

      try {
        const result = await executeTransaction(async userOpHash => {
          clientTxId = await createActivity({
            ...params,
            userOpHash,
          });
        });

        if ((result as any) === USER_CANCELLED_TRANSACTION) {
          return result;
        }

        const transaction =
          result && typeof result === 'object' && 'transaction' in result
            ? (result as any).transaction
            : result;

        if (isSuccess && !getTransactionHash(transaction)) {
          return result;
        }

        if (!clientTxId) {
          clientTxId = await createActivity(params);
        }

        if (transaction && typeof transaction === 'object') {
          const txHash = getTransactionHash(transaction);
          const user = getSelectedUser();

          if (txHash && params.chainId) {
            const currentState = useActivityStore.getState();
            const userEvents = currentState.events[user?.userId ?? ''] || [];
            const currentActivity = userEvents.find(a => a.clientTxId === clientTxId);
            const currentStatus = currentActivity?.status;

            const isTerminal = currentStatus ? TERMINAL_STATUSES.has(currentStatus) : false;

            updateActivity(clientTxId, {
              status: isTerminal ? currentStatus! : params.status || TransactionStatus.PROCESSING,
              hash: txHash,
              url: getExplorerUrl(params.chainId, txHash),
              metadata: {
                submittedAt: new Date().toISOString(),
              },
            });
          }
        }

        return result;
      } catch (error: any) {
        if (isSuccess) {
          throw error;
        }

        if (clientTxId) {
          updateActivity(clientTxId, {
            status: TransactionStatus.FAILED,
            metadata: {
              error: error?.message || 'Transaction failed',
              failedAt: new Date().toISOString(),
            },
          });
        } else {
          const failedClientTxId = await createActivity(params);
          updateActivity(failedClientTxId, {
            status: TransactionStatus.FAILED,
            metadata: {
              error: error?.message || 'Transaction failed',
              failedAt: new Date().toISOString(),
            },
          });
        }

        throw error;
      }
    },
    [createActivity, updateActivity, TERMINAL_STATUSES],
  );

  return {
    createActivity,
    updateActivity,
    trackTransaction,
    getKey,
  };
}
