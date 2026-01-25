import { useQuery } from '@tanstack/react-query';
import { secondsToMilliseconds } from 'date-fns';

import { fetchAttributes, fetchPoints, fetchTierTable } from '@/lib/api';
import { AttributeCategory, TierTableCategory } from '@/lib/types';
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

export const useAttributes = (category: AttributeCategory) => {
  return useQuery({
    queryKey: [REWARDS, 'attributes', category],
    queryFn: async () => {
      return await withRefreshToken(() => fetchAttributes(category));
    },
    staleTime: secondsToMilliseconds(60),
  });
};
