import { useEffect } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';

import PageLayout from '@/components/PageLayout';
import CompareTiersTable from '@/components/Rewards/CompareTiersTable';
import EarnPointsSection from '@/components/Rewards/EarnPointsSection';
import RewardsBenefitsScreenNew from '@/components/Rewards/NewRewards/RewardsBenefitsScreenNew';
import TierFeesTable from '@/components/Rewards/TierFeesTable';
import { BackButton } from '@/components/ui/back-button';
import { Text } from '@/components/ui/text';
import { path } from '@/constants/path';
import { useDimension } from '@/hooks/useDimension';
import { useRewardsUserData, useTierBenefits } from '@/hooks/useRewards';

export default function RewardsBenefits() {
  // qa/preview builds see the redesigned tier-explore screen on mobile; desktop
  // keeps the existing CompareTiersTable-based layout.
  const { isDesktop } = useDimension();
  return isDesktop ? <LegacyRewardsBenefits /> : <RewardsBenefitsScreenNew />;
}

function LegacyRewardsBenefits() {
  const { isScreenMedium } = useDimension();
  const { data: tierBenefits, isLoading } = useTierBenefits();
  const {
    data: rewardsData,
    isLoading: isRewardsUserDataLoading,
    isError: isRewardsUserDataError,
  } = useRewardsUserData();

  const hasOptedIn = rewardsData?.hasOptedIn ?? true;
  const rewardsLocked = Boolean(rewardsData && !hasOptedIn);

  useEffect(() => {
    if (rewardsLocked || isRewardsUserDataError) {
      router.replace(path.REWARDS);
    }
  }, [isRewardsUserDataError, rewardsLocked]);

  if (
    isRewardsUserDataLoading ||
    isRewardsUserDataError ||
    rewardsLocked ||
    isLoading ||
    !tierBenefits
  ) {
    return <PageLayout isLoading={true}>{null}</PageLayout>;
  }

  return (
    <PageLayout isLoading={isLoading}>
      <View className="mx-auto w-full max-w-7xl gap-8 px-4 pb-24 pt-6 md:gap-12 md:py-12">
        <View className="flex-row items-center gap-6">
          <BackButton onPress={() => router.push(path.REWARDS)} />
          <Text className="text-2xl font-semibold opacity-50">Rewards</Text>
        </View>

        {isScreenMedium && (
          <View className="flex-row items-center justify-between">
            <Text className="text-5xl font-semibold">Rewards benefits</Text>
          </View>
        )}

        {!isScreenMedium && <Text className="text-3xl font-semibold">Rewards benefits</Text>}

        <EarnPointsSection />
        <CompareTiersTable tierBenefits={tierBenefits} />
        <TierFeesTable tierBenefits={tierBenefits} />
      </View>
    </PageLayout>
  );
}
