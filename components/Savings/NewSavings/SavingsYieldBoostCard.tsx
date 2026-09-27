import { ActivityIndicator, Pressable, View } from 'react-native';
import Toast from 'react-native-toast-message';
import { formatUnits } from 'viem';
import { fuse } from 'viem/chains';

import { resolveTierBenefitRates } from '@/components/Rewards/NewRewards/tierBenefitCards';
import Skeleton from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { useNativePriceUsd } from '@/hooks/useNativePriceUsd';
import { useRewardsUserData } from '@/hooks/useRewards';
import { useClaimYieldBoost, useYieldBoostRewards } from '@/hooks/useYieldBoostRewards';
import { isDevFeatureEnabled } from '@/lib/config';
import { YIELD_BOOST_REWARD_DECIMALS } from '@/lib/merklYieldBoost';
import { formatBalanceUSD, formatNumber } from '@/lib/utils';

/**
 * Figma 26134:23293 — "Yield boost": the extra APY the user's rewards tier adds
 * on top of the base savings yield, what it has paid so far, and the claim.
 *
 * The boost is paid in FUSE through Merkl, across all three vaults, so the card
 * is the same whichever vault the screen shows. It renders nothing for a user
 * with no boost and nothing left to claim, so Core users don't see an empty box
 * for a perk they haven't unlocked — while someone who dropped a tier can still
 * collect what they earned at the old one. Off production the boost is
 * previewed at stock Prime rates instead, matching the rewards screen so the
 * card is reviewable from a Core test account.
 */
const SavingsYieldBoostCard = () => {
  const { data: rewardsData } = useRewardsUserData();
  const { data: boostRewards, isLoading: isRewardsLoading } = useYieldBoostRewards();
  const { mutateAsync: claim, isPending: isClaiming } = useClaimYieldBoost();
  const fusePriceUsd = useNativePriceUsd(fuse.id, 'fusePriceUsd', true);

  const { yieldBoostPercentage: boostPercentage } = resolveTierBenefitRates(
    {
      yieldBoostPercentage: rewardsData?.yieldBoostPercentage ?? 0,
      yieldBoostCap: rewardsData?.yieldBoostCap ?? 0,
      yieldBoostEarned: rewardsData?.yieldBoostEarned ?? 0,
      subscriptionDiscountRate: rewardsData?.subscriptionDiscountRate ?? 0,
    },
    isDevFeatureEnabled,
  );

  const claimable = boostRewards?.claimable ?? 0n;
  if (boostPercentage <= 0 && claimable === 0n) return null;

  const priceUsd = fusePriceUsd > 0 ? fusePriceUsd : (boostRewards?.priceUsd ?? 0);
  const earnedUsd =
    Number(formatUnits(boostRewards?.earned ?? 0n, YIELD_BOOST_REWARD_DECIMALS)) * priceUsd;
  const canClaim = claimable > 0n && !isClaiming;

  const handleClaim = async () => {
    try {
      const result = await claim();
      if (!result) return;
      Toast.show({
        type: 'success',
        text1: 'Yield boost claimed',
        text2: `${formatNumber(Number(result.amount), 2)} FUSE`,
        props: { badgeText: 'Onchain' },
      });
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: "Couldn't claim yield boost",
        text2: error instanceof Error ? error.message : undefined,
        props: { badgeText: 'Onchain' },
      });
    }
  };

  return (
    <View className="mx-4 overflow-hidden rounded-twice bg-card">
      <View className="h-[54px] justify-center px-5">
        <Text className="text-base font-semibold leading-4 text-white">Yield boost</Text>
      </View>
      <View className="h-px bg-[#2A2A2A]" />

      <View className="flex-row items-center px-5 pb-[18px] pt-[19px]">
        <View className="flex-1">
          <Text className="text-sm font-medium leading-[14px] text-white/50">Boost amount</Text>
          {boostPercentage > 0 ? (
            <View className="mt-[7px] h-[23px] items-center justify-center self-start rounded-lg bg-white px-[7px]">
              <Text className="text-sm font-semibold text-[#282041]">
                +{formatNumber(boostPercentage, 2, 0)}% Boost
              </Text>
            </View>
          ) : (
            <Text className="mt-[7px] text-sm font-semibold leading-[23px] text-white/50">—</Text>
          )}
        </View>
        <View className="flex-1">
          <Text className="text-sm font-medium leading-[14px] text-white/50">Total Earned</Text>
          {isRewardsLoading ? (
            <Skeleton className="mt-[7px] h-6 w-[88px] rounded-md bg-white/10" />
          ) : (
            <Text
              className="mt-[7px] text-[22px] text-white"
              style={{ fontFamily: 'MonaSans_600SemiBold', lineHeight: 24 }}
            >
              {formatBalanceUSD(earnedUsd)}
            </Text>
          )}
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Claim yield boost"
          accessibilityState={{ disabled: !canClaim, busy: isClaiming }}
          disabled={!canClaim}
          onPress={handleClaim}
          className={`h-[37px] min-w-[80px] items-center justify-center rounded-full px-[21px] ${
            canClaim
              ? 'bg-[#94F27F] transition-all active:scale-95 active:opacity-80'
              : 'bg-white/10'
          }`}
        >
          {isClaiming ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text
              className={canClaim ? 'text-black' : 'text-white/70'}
              style={{ fontFamily: 'MonaSans_600SemiBold', fontSize: 16, lineHeight: 20 }}
            >
              Claim
            </Text>
          )}
        </Pressable>
      </View>
    </View>
  );
};

export default SavingsYieldBoostCard;
