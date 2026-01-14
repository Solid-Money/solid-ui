import { useQuery } from '@tanstack/react-query';
import { secondsToMilliseconds } from 'date-fns';

import { mockFetchRewardsUserData, mockFetchTierBenefits } from '@/lib/api';
import { withRefreshToken } from '@/lib/utils';

const REWARDS = 'rewards';

export const useRewardsUserData = () => {
  return useQuery({
    queryKey: [REWARDS, 'userData'],
    queryFn: async () => {
      return await withRefreshToken(() => mockFetchRewardsUserData());
    },
    staleTime: secondsToMilliseconds(30),
    gcTime: secondsToMilliseconds(300),
  });
};

export const useTierBenefits = () => {
  return useQuery({
    queryKey: [REWARDS, 'tierBenefits'],
    queryFn: async () => {
      return await withRefreshToken(() => mockFetchTierBenefits());
    },
    staleTime: secondsToMilliseconds(60),
  });
};
