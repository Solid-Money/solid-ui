import { useCallback, useMemo } from 'react';

import { useActivity } from '@/hooks/useActivity';
import { useBridgeDepositStatuses } from '@/hooks/useBridgeDepositStatuses';
import { useCardDepositPoller } from '@/hooks/useCardDepositPoller';
import { useCardStatus } from '@/hooks/useCardStatus';
import { useCardTransactions } from '@/hooks/useCardTransactions';
import { useProcessingActivitiesPolling } from '@/hooks/useTransactionReceiptPolling';
import { TransactionStatus } from '@/lib/types';
import { hasCard, isTransactionStuck } from '@/lib/utils';
import { deduplicateTransactions } from '@/lib/utils/deduplicateTransactions';
import { mergeActivityFeeds, UnifiedActivityItem } from '@/lib/utils/unifiedActivity';

export type UseUnifiedActivityResult = {
  /** Wallet activity and card history in one feed, newest first. */
  items: UnifiedActivityItem[];
  isLoading: boolean;
  isSyncing: boolean;
  isSyncStale: boolean;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  /** Advances whichever of the two sources still has pages left. */
  loadMore: () => void;
  refetchAll: (force?: boolean) => void;
  userHasCard: boolean;
};

/**
 * The app's one activity feed: everything the wallet did and everything the card
 * did, merged and sorted by time.
 *
 * Both the wallet's "Recent activity" section and the Activity screen read from
 * here, so a row cannot look like one thing in one place and another elsewhere.
 * Filtering by chip and by search stays with the caller — see
 * `filterUnifiedActivity` — because only the caller knows which chip is active.
 *
 * Stuck pending and cancelled rows are left out, matching what the wallet list
 * has always shown.
 */
export function useUnifiedActivity(): UseUnifiedActivityResult {
  const { data: cardStatus } = useCardStatus();
  const userHasCard = hasCard(cardStatus);

  const {
    activities,
    isLoading,
    isSyncing,
    isSyncStale,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
    refetchAll,
  } = useActivity();

  const {
    data: cardData,
    isLoading: isCardLoading,
    hasNextPage: hasNextCardPage,
    isFetchingNextPage: isFetchingNextCardPage,
    fetchNextPage: fetchNextCardPage,
  } = useCardTransactions({ enabled: userHasCard });

  const activitiesWithBridgeStatus = useBridgeDepositStatuses(activities);

  // Both are self-gating — they do nothing unless something is actually in
  // flight — so every screen showing the feed keeps its rows moving on their own.
  useProcessingActivitiesPolling(activities);
  useCardDepositPoller();

  const cardTransactions = useMemo(
    () => cardData?.pages.flatMap(page => page.data) ?? [],
    [cardData],
  );

  const items = useMemo(() => {
    const deduplicated = deduplicateTransactions(activitiesWithBridgeStatus);
    const visible = deduplicated.filter(transaction => {
      if (transaction.status === TransactionStatus.CANCELLED) return false;
      const isPending = transaction.status === TransactionStatus.PENDING;
      return !(isPending && isTransactionStuck(transaction.timestamp));
    });
    return mergeActivityFeeds(visible, cardTransactions);
  }, [activitiesWithBridgeStatus, cardTransactions]);

  const loadMore = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      void fetchNextPage();
    }
    if (hasNextCardPage && !isFetchingNextCardPage) {
      void fetchNextCardPage();
    }
  }, [
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
    hasNextCardPage,
    isFetchingNextCardPage,
    fetchNextCardPage,
  ]);

  return {
    items,
    isLoading: isLoading || (userHasCard && isCardLoading),
    isSyncing,
    isSyncStale,
    hasNextPage: hasNextPage || !!hasNextCardPage,
    isFetchingNextPage: isFetchingNextPage || isFetchingNextCardPage,
    loadMore,
    refetchAll,
    userHasCard,
  };
}
