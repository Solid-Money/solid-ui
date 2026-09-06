import { useMemo } from 'react';
import { InfiniteData, useInfiniteQuery } from '@tanstack/react-query';

import { getCardTransactions } from '@/lib/api';
import { CardTransaction, CardTransactionsResponse } from '@/lib/types';

type QueryResponse = {
  data: CardTransactionsResponse['data'];
  nextPage: string | undefined;
  hasNextPage: boolean;
};

/**
 * `enabled` exists for callers that render for cardholders and non-cardholders
 * alike (the merged activity feed): there is no card history to ask for without
 * a card, and the request errors rather than coming back empty.
 */
export const useCardTransactions = (options?: { enabled?: boolean }) => {
  return useInfiniteQuery<
    QueryResponse,
    Error,
    InfiniteData<QueryResponse>,
    string[],
    string | undefined
  >({
    enabled: options?.enabled ?? true,
    queryKey: cardTransactionsQueryKey,
    queryFn: async ({ pageParam }) => {
      const response = await getCardTransactions(pageParam);
      return {
        data: response.data,
        nextPage: response.pagination_token,
        hasNextPage: response.page < response.total_pages,
      };
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: lastPage => lastPage.nextPage,
    maxPages: 10, // Limit pages in memory to prevent memory issues with large transaction history
  });
};

export const cardTransactionsQueryKey = ['cardTransactions'];

/**
 * One transaction out of the cached card history.
 *
 * The detail screen's own read can come back empty — the issuer does not serve
 * a single-transaction read for every row it puts in the feed (Wirex 404s
 * declined ones) — and the feed row the user tapped already carries the
 * merchant, amount, currency and status that screen leads with. Reading it from
 * the cache costs no request in the case that matters: the list is what the
 * user came from, so it is already there.
 *
 * `fetchIfMissing` loads the first page for the cold case — a deep link or a
 * web refresh straight onto the detail route, where no list has run.
 */
export const useCardTransactionFromList = (
  transactionId?: string | null,
  options?: { fetchIfMissing?: boolean },
): { transaction: CardTransaction | undefined; isFetching: boolean } => {
  const { data, isFetching } = useCardTransactions({
    enabled: !!transactionId && !!options?.fetchIfMissing,
  });

  const transaction = useMemo(() => {
    if (!transactionId) return undefined;
    return data?.pages
      .flatMap(page => page.data)
      .find(cardTransaction => cardTransaction.id === transactionId);
  }, [data, transactionId]);

  return { transaction, isFetching };
};
