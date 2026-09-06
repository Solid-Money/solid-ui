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
import { selectedRewardsUserId, useRewardsUpgradeStore } from '@/store/useRewardsUpgradeStore';
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

/**
 * Referral summary.
 *
 * `refetchInterval` lets the referral screen poll while a reward is settling —
 * the countdown has run out but the payout sweep hasn't reported PAID yet — so
 * the row flips to Completed on its own instead of leaving the user staring at
 * an expired timer and opening a support ticket.
 */
export const useReferralSummary = (options?: { refetchInterval?: number | false }) => {
  const userId = useSelectedUserId();
  return useQuery({
    queryKey: [REWARDS, 'referralSummary', userId],
    queryFn: async () => {
      return await withRefreshToken(() => fetchReferralSummary());
    },
    staleTime: secondsToMilliseconds(30),
    gcTime: secondsToMilliseconds(300),
    refetchInterval: options?.refetchInterval ?? false,
  });
};

export const useRewardsUserData = (options?: { refetchInterval?: number | false }) => {
  const userId = useSelectedUserId();
  const hasConfirmedTier = useRewardsUpgradeStore(
    state => state.userId === userId && !!state.confirmed,
  );
  return useQuery({
    queryKey: [REWARDS, 'userData', userId],
    queryFn: async () => {
      const session = useRewardsUpgradeStore.getState().session;
      const assertAccount = () => {
        if (
          !userId ||
          userId !== selectedRewardsUserId() ||
          session !== useRewardsUpgradeStore.getState().session
        )
          throw new Error('Rewards account changed');
      };
      assertAccount();
      const data = await withRefreshToken(() => {
        assertAccount();
        return fetchRewardsUserData();
      });
      assertAccount();
      useRewardsUpgradeStore.getState().observe(userId!, session, data);
      return data;
    },
    enabled: !!userId,
    refetchInterval: options?.refetchInterval ?? false,
    // A cached response from an earlier account session cannot establish this
    // session's baseline. Switching back must fetch even within staleTime.
    staleTime: hasConfirmedTier ? secondsToMilliseconds(30) : 0,
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
