import { useQuery } from '@tanstack/react-query';

import { getCashbacks } from '@/lib/api';
import { Cashback } from '@/lib/types';

export const useCashbacks = (options?: { enabled?: boolean }) => {
  return useQuery<Cashback[], Error>({
    queryKey: cashbacksQueryKey,
    queryFn: getCashbacks,
    enabled: options?.enabled ?? true,
  });
};

export const cashbacksQueryKey = ['cashbacks'];
