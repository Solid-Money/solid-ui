import { useQuery } from '@tanstack/react-query';

import { getDepositBonusConfig } from '@/lib/api';

export const useDepositBonusConfig = () => {
  const { data, isLoading, error } = useQuery({
    queryKey: ['deposit-bonus-config'],
    queryFn: getDepositBonusConfig,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  return {
    isEnabled: data?.isEnabled ?? false,
    percentage: data?.percentage ?? 0,
    cap: data?.cap ?? 0,
    isLoading,
    error,
  };
};
