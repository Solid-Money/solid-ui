import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';

import PageLayout from '@/components/PageLayout';
import ReferralProgramModal from '@/components/Referral/ReferralProgramModal';
import RewardsWelcomePopup from '@/components/Rewards/RewardsWelcomePopup';
import { Text } from '@/components/ui/text';
import { path } from '@/constants/path';
import { useOptInToRewards, useReferralSummary, useRewardsUserData } from '@/hooks/useRewards';
import { RewardsTier } from '@/lib/types';
import { useRewardsWelcomePopupStore } from '@/store/useRewardsWelcomePopupStore';

import DailyBenefits from './DailyBenefits';
import PointsHeadline from './PointsHeadline';
import RewardsSummaryCard from './RewardsSummaryCard';

/**
 * Redesigned rewards screen (Apple "glass" style), shown only on qa/preview
 * builds via the dispatcher in rewards/index.tsx. Production and all
 * desktop-web users keep the legacy rewards screen.
 *
 * Shows the user's CURRENT tier + points, a rewards summary (cashback +
 * referrals), and the current tier's daily benefits. "Invite friends" opens the
 * referral program popup; "Explore tiers" opens the rewards benefits screen
 * (full tier comparison).
 */
export default function RewardsScreenNew() {
  const { data: rewardsData, isLoading } = useRewardsUserData();
  const { data: referralSummary } = useReferralSummary();
  const { mutate: joinRewards, isPending: isJoining } = useOptInToRewards();
  const welcomeDismissed = useRewardsWelcomePopupStore(state => state.dismissed);
  const setWelcomeDismissed = useRewardsWelcomePopupStore(state => state.setDismissed);

  const { referral: referralParam } = useLocalSearchParams<{ referral?: string }>();
  const [isReferralModalOpen, setIsReferralModalOpen] = useState(false);

  // The rewards program requires an explicit opt-in; `hasOptedIn` defaults to
  // true when the backend doesn't send it, so we never prompt prematurely.
  const hasOptedIn = rewardsData?.hasOptedIn ?? true;
  const rewardsLocked = Boolean(rewardsData && !hasOptedIn);
  const legacyPoints = rewardsData?.legacyPoints ?? 0;
  const showWelcomePopup = rewardsLocked && !welcomeDismissed;

  useEffect(() => {
    if (rewardsLocked && welcomeDismissed) {
      router.replace(path.HOME);
    }
  }, [rewardsLocked, welcomeDismissed]);

  // Support the `/rewards?referral=open` deep link (e.g. settings "Refer & Earn").
  useEffect(() => {
    if (referralParam === 'open') {
      setIsReferralModalOpen(true);
      router.setParams({ referral: undefined });
    }
  }, [referralParam]);

  if (isLoading) {
    return <PageLayout isLoading={true}>{null}</PageLayout>;
  }

  // Rewards data failed to load (or the user has none yet) — render the full
  // page with Core-tier defaults and zeroed stats rather than an error state.
  const currentTier = rewardsData?.currentTier ?? RewardsTier.CORE;
  const totalPoints = rewardsData?.totalPoints ?? 0;

  if (rewardsLocked) {
    return (
      <PageLayout isLoading={welcomeDismissed}>
        <RewardsWelcomePopup
          isOpen={showWelcomePopup}
          variant={legacyPoints > 0 ? 'existing' : 'new'}
          oldPoints={legacyPoints}
          legacyCarryoverPoints={rewardsData?.legacyCarryoverPoints ?? 0}
          startingTier={rewardsData?.startingTier ?? currentTier}
          isJoining={isJoining}
          onAgree={() => joinRewards()}
          onClose={() => {
            setWelcomeDismissed(true);
            router.replace(path.HOME);
          }}
        />
      </PageLayout>
    );
  }

  const cashback = rewardsData?.cashbackThisMonth ?? 0;
  const referrals = referralSummary?.totalRewardedUsd ?? 0;

  return (
    <PageLayout mobileTitle={null}>
      <View className="mb-5 w-full gap-8 pb-24">
        <View className="gap-5">
          <PointsHeadline tier={currentTier} points={totalPoints} />
          <View className="flex-row gap-3 px-4">
            <Pressable
              onPress={() => setIsReferralModalOpen(true)}
              className="h-14 flex-1 items-center justify-center rounded-full bg-white transition-all active:scale-95 active:opacity-80"
            >
              <Text className="text-base font-bold text-black">Invite friends</Text>
            </Pressable>
            <Pressable
              onPress={() => router.push(path.REWARDS_BENEFITS)}
              className="h-14 flex-1 items-center justify-center rounded-full bg-[#1C1C1C] transition-all active:scale-95 active:opacity-80"
            >
              <Text className="text-base font-semibold text-white">Explore tiers</Text>
            </Pressable>
          </View>
        </View>

        <RewardsSummaryCard cashback={cashback} referrals={referrals} tier={currentTier} />

        <DailyBenefits tier={currentTier} />
      </View>

      <ReferralProgramModal
        isOpen={isReferralModalOpen}
        onClose={() => setIsReferralModalOpen(false)}
      />
    </PageLayout>
  );
}
