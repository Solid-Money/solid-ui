import { useEffect, useMemo, useRef } from 'react';

import { useCardProvider } from '@/hooks/useCardProvider';
import { useCardTransactions } from '@/hooks/useCardTransactions';
import { useLayerZeroStatuses } from '@/hooks/useLayerZeroStatuses';
import { ActivityEvent, CardProvider, TransactionStatus, TransactionType } from '@/lib/types';

/** A bridge deposit older than this is history; there is nothing left to track. */
const RECENT_WINDOW_SECONDS = 86_400;

/**
 * Bridge deposits, with their status corrected for what LayerZero and the card
 * issuer actually say.
 *
 * A `BRIDGE_DEPOSIT` reads SUCCESS as soon as the source transaction mines, but
 * the money has not reached the card until LayerZero delivers it and the issuer
 * reports it — minutes later. Until both are true the row stays PENDING, so a
 * user is not told their deposit landed while it is still in flight.
 *
 * The LayerZero → card-transaction cross-check matches the LZ destination tx
 * hash against `crypto_transaction_details.tx_hash`, which only the deprecated
 * Bridge card API returns. Rain card transactions carry no crypto tx details, so
 * under Rain the check could never pass and would pin every successful deposit
 * at "Pending" forever — Rain rows trust the activity status instead (completed
 * server-side from Rain collateral webhooks).
 *
 * Returns the same array identity when nothing was overridden — the common case
 * — so every memo hanging off the result keeps its previous value.
 */
export function useBridgeDepositStatuses(activities: ActivityEvent[]): ActivityEvent[] {
  const { provider } = useCardProvider();
  const isBridgeCardProvider = provider === CardProvider.BRIDGE;

  // Card history is only read for the cross-check above, so there is nothing to
  // fetch for any other issuer.
  const { data: cardData } = useCardTransactions({ enabled: isBridgeCardProvider });
  const cardTransactions = useMemo(
    () => cardData?.pages.flatMap(page => page.data) ?? [],
    [cardData],
  );

  // Tracked in a ref rather than state: this only ever grows, and a state update
  // here would re-run the memo that produced it on every render.
  const completedBridgeTxHashesRef = useRef<Set<string>>(new Set());

  // Only check deposits from the last day, so history is not re-checked forever.
  const bridgeDepositHashes = useMemo(() => {
    if (!isBridgeCardProvider) return [];
    const now = Date.now() / 1000;
    return activities
      .filter(
        activity =>
          activity.type === TransactionType.BRIDGE_DEPOSIT &&
          activity.status === TransactionStatus.SUCCESS &&
          activity.hash &&
          !completedBridgeTxHashesRef.current.has(activity.hash) &&
          now - parseInt(activity.timestamp) < RECENT_WINDOW_SECONDS,
      )
      .map(activity => activity.hash)
      .filter(Boolean) as string[];
  }, [activities, isBridgeCardProvider]);

  // Keyed by bridge tx hash, and referentially stable until a delivery status
  // actually moves.
  const lzDeliveries = useLayerZeroStatuses(bridgeDepositHashes);

  // Mark bridge deposits as completed once delivered and seen in card history.
  // A ref mutation, so no re-render cycle is possible.
  useEffect(() => {
    for (const transaction of activities) {
      if (
        transaction.type !== TransactionType.BRIDGE_DEPOSIT ||
        transaction.status !== TransactionStatus.SUCCESS ||
        !transaction.hash ||
        completedBridgeTxHashesRef.current.has(transaction.hash)
      ) {
        continue;
      }

      const delivery = lzDeliveries[transaction.hash];
      const dstTxHash = delivery?.isDelivered ? delivery.destinationTxHash : undefined;
      if (!dstTxHash) continue;

      const foundInCard = cardTransactions.some(
        ct => ct.crypto_transaction_details?.tx_hash?.toLowerCase() === dstTxHash.toLowerCase(),
      );
      if (foundInCard) {
        completedBridgeTxHashesRef.current.add(transaction.hash);
      }
    }
  }, [activities, lzDeliveries, cardTransactions]);

  return useMemo(() => {
    let hasOverride = false;

    const overridden = activities.map(transaction => {
      if (
        transaction.type !== TransactionType.BRIDGE_DEPOSIT ||
        transaction.status !== TransactionStatus.SUCCESS ||
        !transaction.hash ||
        !(transaction.hash in lzDeliveries)
      ) {
        return transaction;
      }

      // Already confirmed as landed — keep it as SUCCESS.
      if (completedBridgeTxHashesRef.current.has(transaction.hash)) return transaction;

      const delivery = lzDeliveries[transaction.hash];
      const dstTxHash =
        delivery.isLoaded && delivery.isDelivered ? delivery.destinationTxHash : undefined;
      const foundInCard =
        !!dstTxHash &&
        cardTransactions.some(
          ct => ct.crypto_transaction_details?.tx_hash?.toLowerCase() === dstTxHash.toLowerCase(),
        );

      // Delivered and found in card history — the effect above will mark it
      // completed; leave the row as it is.
      if (foundInCard) return transaction;

      hasOverride = true;
      return { ...transaction, status: TransactionStatus.PENDING };
    });

    // Nothing was overridden (no in-flight bridge deposits), so hand back the
    // same array and let every memo downstream keep its result.
    return hasOverride ? overridden : activities;
  }, [activities, lzDeliveries, cardTransactions]);
}
