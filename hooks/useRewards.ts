import { useQuery } from '@tanstack/react-query';
import { minutesToMilliseconds, secondsToMilliseconds } from 'date-fns';

import {
  fetchRewardsConfig,
  fetchRewardsUserData,
  fetchTierBenefits,
  getJWTToken,
} from '@/lib/api';
import { withRefreshToken } from '@/lib/utils';

const REWARDS = 'rewards';

export const useRewardsUserData = () => {
  return useQuery({
    queryKey: [REWARDS, 'userData'],
    queryFn: async () => {
      return await withRefreshToken(() => fetchRewardsUserData());
    },
    enabled: !!getJWTToken(),
    staleTime: secondsToMilliseconds(30),
    gcTime: secondsToMilliseconds(300),
  });
};

export const useTierBenefits = () => {
  return useQuery({
    enabled: !!getJWTToken(),
    queryKey: [REWARDS, 'tierBenefits'],
    queryFn: fetchTierBenefits,
    staleTime: secondsToMilliseconds(60),
  });
};

export const useRewardsConfig = () => {
  return useQuery({
    enabled: !!getJWTToken(),
    queryKey: [REWARDS, 'config'],
    queryFn: fetchRewardsConfig,
    staleTime: minutesToMilliseconds(5),
  });
};
