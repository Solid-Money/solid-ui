import { useEffect, useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { RotateCw } from 'lucide-react-native';

import { HomeBanners } from '@/components/Dashboard/HomeBanners';
import PageLayout from '@/components/PageLayout';
import ReferralProgramBanner from '@/components/Points/ReferralProgramBanner';
import ReferralProgramModal from '@/components/Referral/ReferralProgramModal';
import CashbackCard from '@/components/Rewards/CashbackCard';
import GetCardRewardsBanner from '@/components/Rewards/GetCardRewardsBanner';
import RewardsScreenNew from '@/components/Rewards/NewRewards/RewardsScreenNew';
import RewardsDashboard from '@/components/Rewards/RewardsDashboard';
import RewardsWelcomePopup from '@/components/Rewards/RewardsWelcomePopup';
import TierBenefitsCards from '@/components/Rewards/TierBenefitsCards';
import { Text } from '@/components/ui/text';
import { path } from '@/constants/path';
import { TRACKING_EVENTS } from '@/constants/tracking-events';
import { useCardStatus } from '@/hooks/useCardStatus';
import { useDimension } from '@/hooks/useDimension';
import { useOptInToRewards, useRewardsUserData } from '@/hooks/useRewards';
import { track } from '@/lib/analytics';
import { isDevFeatureEnabled } from '@/lib/config';
import { hasCard } from '@/lib/utils';
import { useRewards } from '@/store/useRewardsStore';
import { useRewardsWelcomePopupStore } from '@/store/useRewardsWelcomePopupStore';

export default function Rewards() {
  // qa/preview builds see the redesigned rewards screen; production — and every
  // desktop-web user — keep the existing design.
  const { isDesktop } = useDimension();
  const showNew = isDevFeatureEnabled && !isDesktop;
  return showNew ? <RewardsScreenNew /> : <LegacyRewards />;
}

function LegacyRewards() {
  const { isScreenMedium } = useDimension();
  const { data: rewardsData, isLoading, isError, refetch } = useRewardsUserData();
  const { setSelectedTierModalId } = useRewards();
  const { mutate: joinRewards, isPending: isJoining } = useOptInToRewards();
  const welcomeDismissed = useRewardsWelcomePopupStore(state => state.dismissed);
  const setWelcomeDismissed = useRewardsWelcomePopupStore(state => state.setDismissed);

  const { referral: referralParam } = useLocalSearchParams<{ referral?: string }>();
  const [isReferralModalOpen, setIsReferralModalOpen] = useState(false);

  // The new rewards program requires an explicit opt-in. `hasOptedIn` defaults to
  // true when the backend doesn't yet send it, so we never prompt prematurely.
  const hasOptedIn = rewardsData?.hasOptedIn ?? true;
  const rewardsLocked = Boolean(rewardsData && !hasOptedIn);
  const legacyPoints = rewardsData?.legacyPoints ?? 0;
  const showWelcomePopup = rewardsLocked && !welcomeDismissed;

  useEffect(() => {
    if (rewardsLocked && welcomeDismissed) {
      router.replace(path.HOME);
    }
  }, [rewardsLocked, welcomeDismissed]);

  // Open the referral popup from a `/rewards?referral=open` deep link, then clear
  // the param so closing the popup doesn't leave a stale deep-link in the URL.
  useEffect(() => {
    if (referralParam === 'open') {
      setIsReferralModalOpen(true);
      router.setParams({ referral: undefined });
    }
  }, [referralParam]);

  const bannerData = useMemo(() => {
    if (!rewardsData) return [];
    const { cashbackThisMonth, cashbackRate, maxCashbackMonthly } = rewardsData;
    return [
      <CashbackCard
        key="cashback"
        cashbackThisMonth={cashbackThisMonth}
        cashbackRate={cashbackRate}
        maxCashbackMonthly={maxCashbackMonthly}
      />,
      // The referral program banner (opens the referral popup) is now shown to
      // all users as part of the referral program launch.
      <ReferralProgramBanner key="refer" />,
    ];
  }, [rewardsData]);

  if (isError && !isLoading) {
    return (
      <PageLayout>
        <View className="flex-1 items-center justify-center px-4 py-12">
          <Text className="mb-4 text-gray-400">Failed to load rewards</Text>
          <Pressable
            onPress={() => refetch()}
            className="flex-row items-center rounded-lg bg-[#2E2E2E] px-4 py-2"
          >
            <RotateCw size={16} color="white" className="mr-2" />
            <Text className="text-white">Try Again</Text>
          </Pressable>
        </View>
      </PageLayout>
    );
  }

  if (isLoading || !rewardsData) {
    return <PageLayout isLoading={true}>{null}</PageLayout>;
  }

  const { currentTier, totalPoints, nextTier, nextTierPoints } = rewardsData;

  if (rewardsLocked) {
    return (
      <PageLayout isLoading={welcomeDismissed}>
        <RewardsWelcomePopup
          isOpen={showWelcomePopup}
          variant={legacyPoints > 0 ? 'existing' : 'new'}
          oldPoints={legacyPoints}
          legacyCarryoverPoints={rewardsData.legacyCarryoverPoints ?? 0}
          startingTier={rewardsData.startingTier ?? currentTier}
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

  return (
    <PageLayout isLoading={isLoading}>
      <View className="mx-auto w-full max-w-7xl gap-6 px-4 pb-24 pt-6 md:gap-10 md:py-12">
        {isScreenMedium ? (
          <View className="flex-row items-center justify-between">
            <Text className="text-3xl font-semibold">Rewards</Text>
          </View>
        ) : (
          <Text className="text-3xl font-semibold">Rewards</Text>
        )}

        <RewardsDashboard
          currentTier={currentTier}
          totalPoints={totalPoints}
          nextTier={nextTier}
          nextTierPoints={nextTierPoints}
          onTierPress={() => setSelectedTierModalId(currentTier)}
        />

        <TierBenefitsCards
          currentTier={currentTier}
          nextTier={nextTier}
          onCurrentTierPress={() => setSelectedTierModalId(currentTier)}
          onNextTierPress={() => setSelectedTierModalId(nextTier)}
        />

        <HomeBanners data={bannerData} />
        <CardBanner />
      </View>
      <ReferralProgramModal
        isOpen={isReferralModalOpen}
        onClose={() => setIsReferralModalOpen(false)}
      />
    </PageLayout>
  );
}

function CardBanner() {
  const { data: cardStatus, isLoading } = useCardStatus();
  if (isLoading) return null;
  if (hasCard(cardStatus)) return null;

  return (
    <GetCardRewardsBanner
      onGetCard={() => {
        track(TRACKING_EVENTS.CARD_GET_CARD_PRESSED, {
          source: 'rewards',
        });

        return router.push(path.CARD_ACTIVATE);
      }}
    />
  );
}
