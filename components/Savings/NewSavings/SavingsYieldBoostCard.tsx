import { View } from 'react-native';

import { resolveTierBenefitRates } from '@/components/Rewards/NewRewards/tierBenefitCards';
import { Text } from '@/components/ui/text';
import { useRewardsUserData } from '@/hooks/useRewards';
import { isDevFeatureEnabled } from '@/lib/config';
import { formatBalanceUSD, formatNumber } from '@/lib/utils';

/**
 * "Yield boost" — the extra APY the user's rewards tier adds on top of the base
 * savings yield, and what it has paid out so far.
 *
 * Renders nothing for tiers that grant no boost, so Core users don't see an
 * empty box for a perk they haven't unlocked. Off production the boost is
 * previewed at stock Prime rates instead, matching the rewards screen so the
 * strip is reviewable from a Core test account.
 */
const SavingsYieldBoostCard = () => {
  const { data: rewardsData } = useRewardsUserData();

  const { yieldBoostPercentage: boostPercentage, yieldBoostEarned } = resolveTierBenefitRates(
    {
      yieldBoostPercentage: rewardsData?.yieldBoostPercentage ?? 0,
      yieldBoostCap: rewardsData?.yieldBoostCap ?? 0,
      yieldBoostEarned: rewardsData?.yieldBoostEarned ?? 0,
      subscriptionDiscountRate: rewardsData?.subscriptionDiscountRate ?? 0,
    },
    isDevFeatureEnabled,
  );

  if (boostPercentage <= 0) return null;

  return (
    <View className="mx-4 overflow-hidden rounded-twice bg-card">
      <View className="h-[54px] justify-center px-5">
        <Text className="text-base font-semibold leading-4 text-white">Yield boost</Text>
      </View>
      <View className="h-px bg-[#2A2A2A]" />

      <View className="flex-row px-5 pb-[18px] pt-[19px]">
        <View className="flex-1">
          <Text className="text-sm font-medium leading-[14px] text-white/50">Boost amount</Text>
          <View className="mt-[7px] h-[23px] items-center justify-center self-start rounded-lg bg-white px-[7px]">
            <Text className="text-sm font-semibold text-[#282041]">
              +{formatNumber(boostPercentage, 2, 0)}% Boost
            </Text>
          </View>
        </View>
        <View className="flex-1">
          <Text className="text-sm font-medium leading-[14px] text-white/50">Total Earned</Text>
          <Text
            className="mt-[7px] text-[22px] text-white"
            style={{ fontFamily: 'MonaSans_600SemiBold', lineHeight: 24 }}
          >
            {formatBalanceUSD(yieldBoostEarned)}
          </Text>
        </View>
      </View>
    </View>
  );
};

export default SavingsYieldBoostCard;
