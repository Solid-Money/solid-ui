import { useMemo } from 'react';
import { Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { RotateCw } from 'lucide-react-native';

import { HomeBanners } from '@/components/Dashboard/HomeBanners';
import PageLayout from '@/components/PageLayout';
import RewardReferBanner from '@/components/Points/RewardReferBanner';
import CashbackCard from '@/components/Rewards/CashbackCard';
import GetCardRewardsBanner from '@/components/Rewards/GetCardRewardsBanner';
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
import { hasCard } from '@/lib/utils';
import { useRewards } from '@/store/useRewardsStore';
import { useRewardsWelcomePopupStore } from '@/store/useRewardsWelcomePopupStore';

export default function Rewards() {
  const { isScreenMedium } = useDimension();
  const { data: rewardsData, isLoading, isError, refetch } = useRewardsUserData();
  const { setSelectedTierModalId } = useRewards();
  const { mutate: joinRewards, isPending: isJoining } = useOptInToRewards();
  const welcomeDismissed = useRewardsWelcomePopupStore(state => state.dismissed);
  const setWelcomeDismissed = useRewardsWelcomePopupStore(state => state.setDismissed);

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
      <RewardReferBanner key="refer" title="Refer a Friend" buttonText="Start earning" />,
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

  // The new rewards program requires an explicit opt-in. `hasOptedIn` defaults to
  // true when the backend doesn't yet send it, so we never prompt prematurely.
  const hasOptedIn = rewardsData.hasOptedIn ?? true;
  const legacyPoints = rewardsData.legacyPoints ?? 0;
  const showWelcomePopup = !hasOptedIn && !welcomeDismissed;

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

      <RewardsWelcomePopup
        isOpen={showWelcomePopup}
        variant={legacyPoints > 0 ? 'existing' : 'new'}
        oldPoints={legacyPoints}
        legacyCarryoverPoints={rewardsData.legacyCarryoverPoints ?? 0}
        startingTier={rewardsData.startingTier ?? currentTier}
        isJoining={isJoining}
        onAgree={() =>
          joinRewards(undefined, {
            onSuccess: () => setWelcomeDismissed(true),
          })
        }
        onClose={() => setWelcomeDismissed(true)}
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
