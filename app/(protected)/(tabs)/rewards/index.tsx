import { router } from 'expo-router';
import { useMemo } from 'react';
import { View } from 'react-native';

import { HomeBanners } from '@/components/Dashboard/HomeBanners';
import PageLayout from '@/components/PageLayout';
import ReferBanner from '@/components/Points/ReferBanner';
import CashbackCard from '@/components/Rewards/CashbackCard';
import GetCardRewardsBanner from '@/components/Rewards/GetCardRewardsBanner';
import RewardsDashboard from '@/components/Rewards/RewardsDashboard';
import TierBenefitsCards from '@/components/Rewards/TierBenefitsCards';
import { Text } from '@/components/ui/text';
import { path } from '@/constants/path';
import { useDimension } from '@/hooks/useDimension';
import { useRewardsUserData } from '@/hooks/useRewards';
import { useCardStatus } from '@/hooks/useCardStatus';
import { useRewards } from '@/store/useRewardsStore';
import { TRACKING_EVENTS } from '@/constants/tracking-events';
import { track } from '@/lib/analytics';

export default function Rewards() {
  const { isScreenMedium } = useDimension();
  const { data: rewardsData, isLoading } = useRewardsUserData();
  const { setSelectedTierModalId } = useRewards();

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
      <ReferBanner key="refer" />,
    ];
  }, [rewardsData]);

  if (isLoading || !rewardsData) {
    return <PageLayout isLoading={true}>{null}</PageLayout>;
  }

  const { currentTier, totalPoints, nextTier, nextTierPoints } = rewardsData;

  return (
    <PageLayout isLoading={isLoading}>
      <View className="mx-auto w-full max-w-7xl gap-6 px-4 pb-24 pt-6 md:gap-10 md:py-12">
        {isScreenMedium ? (
          <View className="flex-row items-center justify-between">
            <Text className="text-5xl font-semibold">Rewards</Text>
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
    </PageLayout>
  );
}

function CardBanner() {
  const { data: cardStatus } = useCardStatus();
  const hasCard = !!cardStatus;

  if (hasCard) return null;

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
