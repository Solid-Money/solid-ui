import { ActivityIndicator, Pressable, View } from 'react-native';
import Toast from 'react-native-toast-message';

import { resolveTierBenefitRates } from '@/components/Rewards/NewRewards/tierBenefitCards';
import Skeleton from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { useClaimYieldBoost, useYieldBoostSummary } from '@/hooks/useRewards';
import { isDevFeatureEnabled } from '@/lib/config';
import { YieldBoostClaim, YieldBoostClaimStatus } from '@/lib/types';
import { cn, formatBalanceUSD, formatNumber } from '@/lib/utils';

/** "1,234.57 soFUSE", from the backend's decimal string. */
const formatSoFuse = (amount: string) => `${formatNumber(Number(amount), 2)} soFUSE`;

/** What to tell the user once the claim request comes back. */
const claimToast = (claim: YieldBoostClaim) => {
  switch (claim.status) {
    case YieldBoostClaimStatus.PAID:
      return {
        type: 'success',
        text1: 'Yield boost claimed',
        text2: formatSoFuse(claim.soFuseAmount),
      };
    case YieldBoostClaimStatus.FAILED:
      return {
        type: 'error',
        text1: "Couldn't claim yield boost",
        text2: 'Nothing was sent. Your boost is still here to claim.',
      };
    default:
      // Sent but not mined within the request; the summary polls until it is.
      return {
        type: 'success',
        text1: 'Yield boost on its way',
        text2: `${formatSoFuse(claim.soFuseAmount)} is being sent to your savings`,
      };
  }
};

interface EarnYieldBoostCardProps {
  className?: string;
}

/**
 * Figma 26134:23293 — "Yield boost": the extra APY the user's rewards tier adds
 * on top of every vault's own yield, what it has earned so far, and the claim.
 *
 * It sits on the Earn page rather than on a vault because it is earned on the
 * user's savings across all three vaults together, and paid in soFUSE whichever
 * vault the money is in. It renders nothing for a user with no boost and
 * nothing to claim, so Core users don't see an empty box for a perk they
 * haven't unlocked — while someone who dropped a tier can still collect what
 * they earned at the old one. Off production the boost is previewed at stock
 * Prime rates, matching the rewards screen, so the card is reviewable from a
 * Core test account.
 */
const EarnYieldBoostCard = ({ className }: EarnYieldBoostCardProps) => {
  const { data: summary, isLoading } = useYieldBoostSummary();
  const { mutateAsync: claim, isPending: isClaiming } = useClaimYieldBoost();

  const { yieldBoostPercentage: boostPercentage } = resolveTierBenefitRates(
    {
      yieldBoostPercentage: summary?.apyPercentage ?? 0,
      yieldBoostCap: 0,
      yieldBoostEarned: summary?.totalEarnedUsd ?? 0,
      subscriptionDiscountRate: 0,
    },
    isDevFeatureEnabled,
  );

  const hasClaimable = Number(summary?.claimableSoFuse ?? 0) > 0;
  const isPaying = isClaiming || Boolean(summary?.pendingClaim);
  if (boostPercentage <= 0 && !hasClaimable && !isPaying) return null;

  const isPaused = hasClaimable && summary?.claimsEnabled === false;
  const canClaim = hasClaimable && !isPaused && !isPaying;

  const handleClaim = async () => {
    try {
      const { claim: result } = await claim();
      Toast.show({ ...claimToast(result), props: { badgeText: 'Onchain' } });
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
    <View className={cn('overflow-hidden rounded-twice bg-card', className)}>
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
          {isLoading ? (
            <Skeleton className="mt-[7px] h-6 w-[88px] rounded-md bg-white/10" />
          ) : (
            <Text
              className="mt-[7px] text-[22px] text-white"
              style={{ fontFamily: 'MonaSans_600SemiBold', lineHeight: 24 }}
            >
              {formatBalanceUSD(summary?.totalEarnedUsd ?? 0)}
            </Text>
          )}
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Claim yield boost"
          accessibilityState={{ disabled: !canClaim, busy: isPaying }}
          disabled={!canClaim}
          onPress={handleClaim}
          className={`h-[37px] min-w-[80px] items-center justify-center rounded-full px-[21px] ${
            canClaim
              ? 'bg-[#94F27F] transition-all active:scale-95 active:opacity-80'
              : 'bg-white/10'
          }`}
        >
          {isPaying ? (
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

      {isPaused ? (
        <Text className="px-5 pb-[18px] text-sm font-medium text-white/50">
          Claims are paused for now. Your boost keeps accruing and nothing is lost.
        </Text>
      ) : null}
    </View>
  );
};

export default EarnYieldBoostCard;
