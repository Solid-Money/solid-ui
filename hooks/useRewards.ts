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
import { useUserStore } from '@/store/useUserStore';

const REWARDS = 'rewards';

// The rewards/referral endpoints return per-user data but are authenticated
// purely by the session — the URL carries no address and getJWTToken() is null
// on web (cookie auth). That means every account hits the exact same query key,
// so after switching wallets React Query serves the previous wallet's cached
// rewards/points to the new one until gcTime expires (the cross-account leak
// seen on web). Scoping the key by the selected user id isolates each account's
// cache, mirroring how the rest of the app keys user data by safeAddress/userId.
const useSelectedUserId = () =>
  useUserStore(state => state.users.find(user => user.selected)?.userId);

export const useReferralSummary = () => {
  const userId = useSelectedUserId();
  return useQuery({
    queryKey: [REWARDS, 'referralSummary', userId],
    queryFn: async () => {
      return await withRefreshToken(() => fetchReferralSummary());
    },
    staleTime: secondsToMilliseconds(30),
    gcTime: secondsToMilliseconds(300),
  });
};

export const useRewardsUserData = () => {
  const userId = useSelectedUserId();
  return useQuery({
    queryKey: [REWARDS, 'userData', userId],
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
  const userId = useSelectedUserId();
  return useMutation({
    mutationFn: async () => await withRefreshToken(() => optInToRewards()),
    onSuccess: (data: RewardsUserData) => {
      // Write to the user-scoped key so the rewards screen reads it back.
      queryClient.setQueryData([REWARDS, 'userData', userId], data);
      void queryClient.invalidateQueries({ queryKey: [REWARDS] });
    },
  });
};
