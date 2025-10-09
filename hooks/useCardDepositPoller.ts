import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';

import { getCardTransactions } from '@/lib/api';
import { TransactionStatus, TransactionType } from '@/lib/types';
import { useActivity } from './useActivity';

/**
 * Polls Bridge's card transactions API to update PENDING card deposits to SUCCESS
 * when Bridge has processed them.
 *
 * This handles the gap between on-chain confirmation and Bridge processing.
 */
export const useCardDepositPoller = () => {
  const { activities, updateActivity } = useActivity();

  // Find pending card deposits
  const pendingCardDeposits = activities.filter(
    activity =>
      activity.type === TransactionType.CARD_TRANSACTION &&
      activity.status === TransactionStatus.PENDING &&
      activity.hash, // Must have a transaction hash to match
  );

  // Poll Bridge API only if we have pending card deposits
  const { data: cardTransactions } = useQuery({
    queryKey: ['card-transactions-poller'],
    queryFn: async () => {
      const response = await getCardTransactions();
      return response.data.filter(tx => tx.category === 'crypto_funding');
    },
    enabled: pendingCardDeposits.length > 0,
    refetchInterval: pendingCardDeposits.length > 0 ? 60000 : false, // Poll every minute if pending
  });

  // Check if any pending deposits have been processed by Bridge
  useEffect(() => {
    if (!cardTransactions || pendingCardDeposits.length === 0) return;

    pendingCardDeposits.forEach(async activity => {
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
        }
      }
    });
  }, [cardTransactions, pendingCardDeposits, updateActivity]);

  return {
    pendingCount: pendingCardDeposits.length,
    isPolling: pendingCardDeposits.length > 0,
  };
};
