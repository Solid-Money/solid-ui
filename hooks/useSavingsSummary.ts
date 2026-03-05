import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { fetchSavingsSummary } from '@/lib/api';
import { SavingsSummaryResponse } from '@/lib/types';

export function useSavingsSummary(vault: string = 'USDC', enabled: boolean = true) {
  return useQuery<SavingsSummaryResponse>({
    queryKey: ['savings-summary', vault],
    queryFn: () => fetchSavingsSummary(vault),
    enabled,
    staleTime: 30_000,
    refetchInterval: 30_000,
    placeholderData: keepPreviousData,
  });
}
