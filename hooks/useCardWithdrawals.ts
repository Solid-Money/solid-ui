import { useQuery, UseQueryOptions } from '@tanstack/react-query';

import { getCardWithdrawals } from '@/lib/api';
import { CardWithdrawalResponse } from '@/lib/types';

interface UseCardWithdrawalsParams {
  limit?: number;
  starting_after?: string;
  ending_before?: string;
}

export const useCardWithdrawals = (
  params?: UseCardWithdrawalsParams,
  options?: Omit<
    UseQueryOptions<{ count: number; data: CardWithdrawalResponse[] }, Error>,
    'queryKey' | 'queryFn'
  >,
) => {
  return useQuery({
    queryKey: ['cardWithdrawals', params],
    queryFn: () => getCardWithdrawals(params),
    ...options,
  });
};
