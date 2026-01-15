import { useEffect, useMemo } from 'react';
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
  // Note: isMounted pattern is unnecessary here because:
  // 1. Zustand store updates are safe after unmount
  // 2. The effect only runs when cardTransactions changes, which React Query manages
  useEffect(() => {
    if (!cardTransactions || pendingCardDeposits.length === 0) return;

    const checkAndUpdate = async () => {
      for (const activity of pendingCardDeposits) {
        // Match by transaction hash
        const matchingCardTx = cardTransactions.find(
          tx => tx.crypto_transaction_details?.tx_hash === activity.hash,
        );

        if (matchingCardTx) {
          // Check if Bridge has completed processing
          const isCompleted = matchingCardTx.status.toLowerCase() === 'posted';

          if (isCompleted) {
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
          }
        }
      }
    };

    void checkAndUpdate();
  }, [cardTransactions, pendingCardDeposits, updateActivity]);

  return {
    pendingCount: pendingCardDeposits.length,
    isPolling: pendingCardDeposits.length > 0,
  };
};
