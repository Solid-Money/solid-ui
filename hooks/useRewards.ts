import { useQuery } from '@tanstack/react-query';
import { secondsToMilliseconds } from 'date-fns';

import { fetchPoints, fetchTierBenefits } from '@/lib/api';
import { withRefreshToken } from '@/lib/utils';

const REWARDS = 'rewards';

export const useUserRewards = () => {
  return useQuery({
    queryKey: [REWARDS, 'user'],
    queryFn: async () => {
      return await withRefreshToken(() => fetchPoints());
    },
    staleTime: secondsToMilliseconds(30),
    gcTime: secondsToMilliseconds(300),
  });
};

export const useTierBenefits = () => {
  return useQuery({
    queryKey: [REWARDS, 'tierBenefits'],
    queryFn: async () => {
      return await withRefreshToken(() => fetchTierBenefits());
    },
    staleTime: secondsToMilliseconds(60),
  });
};
