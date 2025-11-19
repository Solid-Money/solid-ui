import { useQuery } from '@tanstack/react-query';

import { getCashbacks } from '@/lib/api';
import { Cashback } from '@/lib/types';

export const useCashbacks = () => {
  return useQuery<Cashback[], Error>({
    queryKey: cashbacksQueryKey,
    queryFn: getCashbacks,
  });
};

export const cashbacksQueryKey = ['cashbacks'];
