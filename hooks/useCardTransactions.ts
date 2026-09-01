import { InfiniteData, useInfiniteQuery } from '@tanstack/react-query';

import { getCardTransactions } from '@/lib/api';
import { CardTransactionsResponse } from '@/lib/types';

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
