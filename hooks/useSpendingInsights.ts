import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';

import { cardTransactionsQueryKey } from '@/hooks/useCardTransactions';
import { useCashbacks } from '@/hooks/useCashbacks';
import { useRewardsUserData } from '@/hooks/useRewards';
import { getCardTransactions } from '@/lib/api';
import { CardTransaction } from '@/lib/types';
import {
  buildSpendingInsights,
  getMonthKey,
  getMonthStart,
  getSpendTimestamp,
  MonthSummary,
  shiftMonthKey,
  SpendingInsights,
} from '@/lib/utils/spendingInsights';

/** Months before the current one the insights cover. */
export const INSIGHTS_MONTHS_BACK = 2;

/**
 * Upper bound on requests per load. Wirex pages hold 50 rows and Rain pages
 * 100, so this covers a few hundred purchases — months of normal use — while
 * keeping a heavy spender from paging through their whole history.
 */
const MAX_PAGES = 8;

type SpendingHistory = {
  transactions: CardTransaction[];
  /** True when every row there is was read, not just the months asked for. */
  historyComplete: boolean;
};

/**
 * Card history back to `cutoffMs`, read page by page.
 *
 * Kept apart from `useCardTransactions` on purpose: that query is the Activity
 * feed, capped at ten pages in memory, and paging it from here would push the
 * newest rows out of the list the user is looking at.
 */
const fetchSpendingHistory = async (cutoffMs: number): Promise<SpendingHistory> => {
  const transactions: CardTransaction[] = [];
  const seen = new Set<string>();
  let token: string | undefined;
  let page = 1;

  for (let request = 0; request < MAX_PAGES; request++) {
    const response = await getCardTransactions(token, page);
    let added = 0;
    for (const transaction of response.data) {
      if (!seen.has(transaction.id)) added += 1;
      seen.add(transaction.id);
      transactions.push(transaction);
    }

    const hasMore = response.page < response.total_pages;
    // A page with nothing new means the numbered pages ran out (Rain repeats
    // its issuer rows on every page), which is the end of the history.
    if (!hasMore || (request > 0 && added === 0)) {
      return { transactions, historyComplete: true };
    }

    const oldest = Math.min(...response.data.map(transaction => getSpendTimestamp(transaction)));
    if (oldest < cutoffMs) return { transactions, historyComplete: false };

    if (response.pagination_token) {
      token = response.pagination_token;
    } else {
      token = undefined;
      page = response.page + 1;
    }
  }

  return { transactions, historyComplete: false };
};

export const spendingHistoryQueryKey = [...cardTransactionsQueryKey, 'insights'];

export type UseSpendingInsightsResult = SpendingInsights & {
  isLoading: boolean;
  isError: boolean;
  refetch: () => void;
  currentMonth?: MonthSummary;
  /** Subscription categories the tier pays cashback on per month (0 = none). */
  subscriptionCategoryLimit: number;
  /** The tier's subscription cashback, in percent (0 = none). */
  subscriptionDiscountRate: number;
};

/**
 * Spending by month and category, worked out on the device.
 *
 * The query key sits under the card-transactions key so the Activity screen's
 * pull-to-refresh, which invalidates that key, refreshes these figures too.
 */
export const useSpendingInsights = (options?: { enabled?: boolean }): UseSpendingInsightsResult => {
  const enabled = options?.enabled ?? true;
  const currentMonthKey = getMonthKey(Date.now());
  const cutoffMs = getMonthStart(shiftMonthKey(currentMonthKey, -INSIGHTS_MONTHS_BACK));

  const history = useQuery({
    queryKey: [...spendingHistoryQueryKey, currentMonthKey],
    queryFn: () => fetchSpendingHistory(cutoffMs),
    enabled,
    staleTime: 60_000,
  });
  const { data: cashbacks, isLoading: isCashbackLoading } = useCashbacks({ enabled });
  const { data: rewards } = useRewardsUserData({ enabled });

  const insights = useMemo(
    () =>
      buildSpendingInsights(history.data?.transactions ?? [], cashbacks, {
        monthsBack: INSIGHTS_MONTHS_BACK,
        historyComplete: history.data?.historyComplete ?? false,
      }),
    [history.data, cashbacks],
  );

  return {
    ...insights,
    currentMonth: insights.months[insights.months.length - 1],
    subscriptionCategoryLimit: rewards?.subscriptionCategoryLimit ?? 0,
    subscriptionDiscountRate: rewards?.subscriptionDiscountRate ?? 0,
    isLoading: enabled && (history.isLoading || isCashbackLoading),
    isError: history.isError,
    refetch: () => void history.refetch(),
  };
};
