import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { minutesToMilliseconds, secondsToMilliseconds } from 'date-fns';

import {
  fetchReferralSummary,
  fetchRewardsConfig,
  fetchRewardsUserData,
  fetchTierBenefits,
  optInToRewards,
} from '@/lib/api';
import { RewardsUserData } from '@/lib/types';
import { withRefreshToken } from '@/lib/utils';

const REWARDS = 'rewards';

export const useReferralSummary = () => {
  return useQuery({
    queryKey: [REWARDS, 'referralSummary'],
    queryFn: async () => {
      return await withRefreshToken(() => fetchReferralSummary());
    },
    staleTime: secondsToMilliseconds(30),
    gcTime: secondsToMilliseconds(300),
  });
};

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

export const useOptInToRewards = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => await withRefreshToken(() => optInToRewards()),
    onSuccess: (data: RewardsUserData) => {
      queryClient.setQueryData([REWARDS, 'userData'], data);
      void queryClient.invalidateQueries({ queryKey: [REWARDS] });
    },
  });
};
