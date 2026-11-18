import { ActivityIndicator, Pressable, View } from 'react-native';
import Toast from 'react-native-toast-message';

import Skeleton from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { useClaimYieldBoost, useYieldBoostSummary } from '@/hooks/useRewards';
import { showFailureSheet } from '@/lib/errors';
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
 * "Yield boost" (Figma 26134:23293, laid out as on the Earn tab, 28551:5563): the extra APY
 * the user's rewards tier adds on top of every vault's own yield, what it has earned so far,
 * and the claim.
 *
 * It sits on the Earn page rather than on a vault because it is earned on the
 * user's savings across every yield together — EUR Yield included, valued in
 * dollars against the same cap — and paid in soFUSE whichever yield the money
 * is in. It renders nothing for a user with no boost and
 * nothing to claim, so Core users don't see an empty box for a perk they
 * haven't unlocked — while someone who dropped a tier can still collect what
 * they earned at the old one.
 *
 * The rate is always the user's own, as the backend reports it — never the
 * rewards screen's off-production preview. This card shows a real balance and
 * a Claim button, so a borrowed rate would tell a Core user they are earning a
 * boost they are not.
 */
const EarnYieldBoostCard = ({ className }: EarnYieldBoostCardProps) => {
  const { data: summary, isLoading } = useYieldBoostSummary();
  const { mutateAsync: claim, isPending: isClaiming } = useClaimYieldBoost();

  const boostPercentage = summary?.apyPercentage ?? 0;

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
      void showFailureSheet(error, { action: 'claim', title: 'Couldn’t claim your yield boost' });
    }
  };

  // What the line under the title says about the claim.
  const claimState = isPaying
    ? 'on its way'
    : isPaused
      ? 'claims paused'
      : hasClaimable
        ? 'ready to claim'
        : undefined;

  return (
    <View className={cn('overflow-hidden rounded-[20px] bg-card', className)}>
      <View className="flex-row items-center gap-3 px-4 py-[18px]">
        <View className="min-w-0 flex-1 gap-[5px]">
          <View className="flex-row items-center gap-2">
            <Text className="text-[16px] font-semibold leading-5 text-white">Yield boost</Text>
            {boostPercentage > 0 ? (
              <View className="rounded-full bg-[#D4C7FF] px-2 py-[2px]">
                <Text className="text-[13px] font-medium leading-[18px] text-[#282041]">
                  +{formatNumber(boostPercentage, 2, 0)}%
                </Text>
              </View>
            ) : null}
          </View>
          {isLoading ? (
            <Skeleton className="h-[18px] w-[160px] rounded-md bg-white/10" />
          ) : (
            <Text className="text-[14px] leading-[18px] text-white/50" numberOfLines={1}>
              {formatBalanceUSD(summary?.totalEarnedUsd ?? 0)} earned
              {claimState ? ` · ${claimState}` : ''}
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
        <Text className="px-4 pb-[18px] text-sm font-medium text-white/50">
          Claims are paused for now. Your boost keeps accruing and nothing is lost.
        </Text>
      ) : null}
    </View>
  );
};

export default EarnYieldBoostCard;
