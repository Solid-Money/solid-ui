import { useQuery } from '@tanstack/react-query';
import { secondsToMilliseconds, minutesToMilliseconds } from 'date-fns';

import { fetchRewardsUserData, fetchTierBenefits, fetchRewardsConfig } from '@/lib/api';
import { withRefreshToken } from '@/lib/utils';

const REWARDS = 'rewards';

export const useRewardsUserData = () => {
  return useQuery({
    queryKey: [REWARDS, 'userData'],
    queryFn: async () => {
      return await withRefreshToken(() => fetchRewardsUserData());
    },
    staleTime: secondsToMilliseconds(30),
    gcTime: secondsToMilliseconds(300),
  });
};

export const useTierBenefits = () => {
  return useQuery({
    queryKey: [REWARDS, 'tierBenefits'],
    queryFn: fetchTierBenefits,
    staleTime: secondsToMilliseconds(60),
  });
};

export const useRewardsConfig = () => {
  return useQuery({
    queryKey: [REWARDS, 'config'],
    queryFn: fetchRewardsConfig,
    staleTime: minutesToMilliseconds(5),
  });
};
