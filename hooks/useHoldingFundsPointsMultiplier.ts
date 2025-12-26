import { useQuery } from '@tanstack/react-query';

import { getHoldingFundsPointsMultiplier } from '@/lib/api';

export const useHoldingFundsPointsMultiplier = () => {
  const { data, isLoading, error } = useQuery({
    queryKey: ['holding-funds-points-multiplier'],
    queryFn: getHoldingFundsPointsMultiplier,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  return {
    multiplier: data?.holdingFundsPointsMultiplier ?? 5, // Default to 5 as per current hardcoded values
    isLoading,
    error,
  };
};
