import { useQuery } from '@tanstack/react-query';

import { getCardDepositBonusConfig } from '@/lib/api';

export const useCardDepositBonusConfig = () => {
  const { data, isLoading, error } = useQuery({
    queryKey: ['card-deposit-bonus-config'],
    queryFn: getCardDepositBonusConfig,
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
