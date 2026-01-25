import { useQuery } from '@tanstack/react-query';
import { secondsToMilliseconds } from 'date-fns';

import { fetchPoints, fetchTierTable } from '@/lib/api';
import { TierTableCategory } from '@/lib/types';
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

export const useTierTable = (category: TierTableCategory) => {
  return useQuery({
    queryKey: [REWARDS, 'tierTable', category],
    queryFn: async () => {
      return await withRefreshToken(() => fetchTierTable(category));
    },
    staleTime: secondsToMilliseconds(60),
  });
};
