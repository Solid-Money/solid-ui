import { useEffect, useMemo, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';

import { TRACKING_EVENTS } from '@/constants/tracking-events';
import { track } from '@/lib/analytics';
import { getCardTransactions } from '@/lib/api';
import { TransactionStatus, TransactionType } from '@/lib/types';

import { useActivity } from './useActivity';

const CARD_TRANSACTIONS_KEY = 'card-transactions-poller';

/**
 * Polls Bridge's card transactions API to update PENDING card deposits to SUCCESS
 * when Bridge has processed them.
 *
 * This handles the gap between on-chain confirmation and Bridge processing.
 */
export const useCardDepositPoller = () => {
  const { activities, updateActivity } = useActivity();

  // Track which clientTxIds we've already updated to prevent duplicate updates
  // This prevents infinite loops when updateActivity triggers a re-render
  const updatedIdsRef = useRef<Set<string>>(new Set());
  // Guard against concurrent update operations
  const isUpdatingRef = useRef(false);

  // Find pending card deposits - memoized to prevent excessive effect runs
  const pendingCardDeposits = useMemo(
    () =>
      activities.filter(
        activity =>
          activity.type === TransactionType.CARD_TRANSACTION &&
          activity.status === TransactionStatus.PENDING &&
          activity.hash, // Must have a transaction hash to match
      ),
    [activities],
  );

  // Fetch Bridge API only if we have pending card deposits (no polling)
  const { data: cardTransactions } = useQuery({
    queryKey: [CARD_TRANSACTIONS_KEY],
    queryFn: async () => {
      const response = await getCardTransactions();
      return response.data.filter(tx => tx.category === 'crypto_funding');
    },
    enabled: pendingCardDeposits.length > 0,
    // No polling - status updates should come from backend
  });

  // Check if any pending deposits have been processed by Bridge
  // Uses ref guards to prevent duplicate updates and infinite loops
  useEffect(() => {
    if (!cardTransactions || pendingCardDeposits.length === 0) return;
    // Prevent concurrent update operations - check BEFORE any async work
    if (isUpdatingRef.current) return;

    // Set lock immediately (synchronously) to prevent race conditions
    // If effect runs twice before async work completes, second invocation will exit above
    isUpdatingRef.current = true;

    const checkAndUpdate = async () => {
      try {
        // Filter to only activities we haven't already updated
        const updates = pendingCardDeposits
          .filter(activity => !updatedIdsRef.current.has(activity.clientTxId))
          .map(activity => {
            const matchingCardTx = cardTransactions.find(
              tx => tx.crypto_transaction_details?.tx_hash === activity.hash,
            );

            if (matchingCardTx && matchingCardTx.status.toLowerCase() === 'posted') {
              return { activity, matchingCardTx };
            }
            return null;
          })
          .filter((update): update is NonNullable<typeof update> => update !== null);

        // No new updates to process
        if (updates.length === 0) return;

        // Mark all as updated BEFORE making async calls to prevent duplicate processing
        for (const { activity } of updates) {
          updatedIdsRef.current.add(activity.clientTxId);
        }

        // Process all updates in parallel - use allSettled so one failure doesn't block others
        const results = await Promise.allSettled(
          updates.map(async ({ activity }) => {
            // Update activity to SUCCESS
            await updateActivity(activity.clientTxId, {
              status: TransactionStatus.SUCCESS,
              metadata: activity.metadata,
            });

            // Track deposit completed
            track(TRACKING_EVENTS.CARD_DEPOSIT_COMPLETED, {
              amount: Number(activity.amount),
              token_symbol: activity.symbol,
              chain_id: activity.chainId,
              tx_hash: activity.hash,
            });
          }),
        );

        // Log any failures for debugging
        const failures = results.filter(r => r.status === 'rejected');
        if (failures.length > 0) {
          console.error(
            '[useCardDepositPoller] Some updates failed:',
            failures.map(f => (f as PromiseRejectedResult).reason),
          );
        }
      } finally {
        // Always release lock, even if errors occur
        isUpdatingRef.current = false;
      }
    };

    void checkAndUpdate();
  }, [cardTransactions, pendingCardDeposits, updateActivity]);

  return {
    pendingCount: pendingCardDeposits.length,
    isPolling: pendingCardDeposits.length > 0,
  };
};
