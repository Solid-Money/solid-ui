import { useEffect } from 'react';
import { Platform } from 'react-native';

import { useCardStatus } from '@/hooks/useCardStatus';
import { useCashbacks } from '@/hooks/useCashbacks';
import { useStoreReview } from '@/hooks/useStoreReview';
import { hasCard } from '@/lib/utils';
import { getNewlyReceivedCashbackIds, getReceivedSoUsdCashbackIds } from '@/lib/utils/storeReview';
import { useStoreReviewStore } from '@/store/useStoreReviewStore';

// Small settle delay so the rating sheet lands at a resting moment rather than
// popping the instant fresh data arrives (e.g. during a refetch or navigation).
const REVIEW_PROMPT_DELAY_MS = 2000;

/**
 * Watches the user's cashbacks and asks for an in-app store review the first time
 * a *new* soUSD cashback payout is received. Payouts that already existed the
 * first time this device runs the feature are captured as a silent baseline, so
 * existing users aren't prompted simply for upgrading — only for a fresh payout.
 *
 * Runs headlessly (renders nothing) and is a no-op on web.
 */
export const useCashbackStoreReview = () => {
  const { requestReview } = useStoreReview();

  const { data: cardStatus } = useCardStatus();
  const userHasCard = hasCard(cardStatus);

  // Only card holders can receive cashback, so avoid the extra request otherwise.
  const { data: cashbacks } = useCashbacks({
    enabled: Platform.OS !== 'web' && userHasCard,
  });

  useEffect(() => {
    if (Platform.OS === 'web') return;
    // Wait for the first successful load ([] once resolved, undefined while pending).
    if (!cashbacks) return;

    const receivedIds = getReceivedSoUsdCashbackIds(cashbacks);

    const state = useStoreReviewStore.getState();

    // First time we see this device's cashbacks: treat whatever is already paid
    // as pre-existing and don't prompt. Anything new after this is prompt-worthy.
    if (!state.hasCapturedBaseline) {
      state.captureBaseline(receivedIds);
      return;
    }

    const newlyReceived = getNewlyReceivedCashbackIds(receivedIds, state.reviewedCashbackIds);
    if (newlyReceived.length === 0) return;

    // Mark them accounted for immediately so refetches don't reprocess the same
    // payout; the review request itself is throttled inside useStoreReview.
    state.markSeen(receivedIds);

    const timer = setTimeout(() => {
      void requestReview({ trigger: 'cashback_received', count: newlyReceived.length });
    }, REVIEW_PROMPT_DELAY_MS);

    return () => clearTimeout(timer);
  }, [cashbacks, requestReview]);
};
