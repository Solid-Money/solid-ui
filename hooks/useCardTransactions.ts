import { InfiniteData, useInfiniteQuery } from '@tanstack/react-query';

import { getCardTransactions } from '@/lib/api';
import { CardTransactionsResponse } from '@/lib/types';

type QueryResponse = {
  data: CardTransactionsResponse['data'];
  nextPage: string | undefined;
  hasNextPage: boolean;
};

export const useCardTransactions = () => {
  return useInfiniteQuery<
    QueryResponse,
    Error,
    InfiniteData<QueryResponse>,
    string[],
    string | undefined
  >({
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
