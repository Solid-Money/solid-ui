import { useEffect, useMemo, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';

import { TRACKING_EVENTS } from '@/constants/tracking-events';
import { track } from '@/lib/analytics';
import { getCardTransactions } from '@/lib/api';
import { CardTransactionCategory, TransactionStatus, TransactionType } from '@/lib/types';

import { useActivity } from './useActivity';

const CARD_TRANSACTIONS_KEY = 'card-transactions-poller';

// Fallback check interval - only used if SSE somehow misses an update
// This is intentionally long since SSE should handle all real-time updates
const FALLBACK_STALE_TIME_MS = 60_000; // 60 seconds

/**
 * @deprecated FALLBACK MECHANISM - SSE is now the primary source of card deposit updates
 *
 * This hook was originally created as a workaround when the backend didn't emit SSE
 * events for card deposits. As of IMPL-BE-CARD (Jan 2026), the backend now:
 * 1. Creates Activity records when card deposits are detected via Bridge webhook
 * 2. Emits SSE 'created' and 'updated' events for card deposit activities
 *
 * The useActivitySSE hook (singleton) handles all activity updates including CARD_TRANSACTION.
 *
 * WHY THIS STILL EXISTS:
 * This hook is kept as a safety net fallback in case:
 * - SSE connection drops and reconnection is delayed
 * - An SSE event is somehow missed
 * - Backend webhook processing has edge case failures
 *
 * The staleTime is set to 60 seconds to minimize unnecessary API calls while
 * still providing a fallback mechanism. SSE should handle all real-time updates.
 *
 * FUTURE: This hook can be fully removed once SSE reliability is confirmed in production
 * over several weeks. Monitor Sentry for any 'card_deposit_fallback_triggered' events.
 *
 * @see useActivitySSE - Primary real-time update mechanism
 * @see IMPL-BE-CARD - Backend implementation that added SSE support
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

  // FALLBACK: Fetch Bridge API only if we have pending card deposits
  // Primary updates should come via SSE from useActivitySSE hook
  // This is a safety net with long staleTime to catch any missed SSE events
  const { data: cardTransactions } = useQuery({
    queryKey: [CARD_TRANSACTIONS_KEY],
    queryFn: async () => {
      const response = await getCardTransactions();
      return response.data.filter(tx => tx.category === CardTransactionCategory.CRYPTO_FUNDING);
    },
    enabled: pendingCardDeposits.length > 0,
    // Long staleTime since SSE should handle real-time updates
    // This is only a fallback safety net
    staleTime: FALLBACK_STALE_TIME_MS,
    // Refetch on window focus as additional fallback (e.g., user returns to app)
    refetchOnWindowFocus: true,
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

            // Track deposit completed via fallback mechanism
            // Note: This should rarely trigger since SSE is the primary update mechanism
            // If this fires frequently, investigate SSE reliability
            track(TRACKING_EVENTS.CARD_DEPOSIT_COMPLETED, {
              amount: Number(activity.amount),
              token_symbol: activity.symbol,
              chain_id: activity.chainId,
              tx_hash: activity.hash,
              // Flag to identify updates from fallback vs SSE in analytics
              source: 'fallback_poller',
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
    // Renamed for clarity - this is now a fallback check, not active polling
    isFallbackActive: pendingCardDeposits.length > 0,
    /** @deprecated Use isFallbackActive instead */
    isPolling: pendingCardDeposits.length > 0,
  };
};
