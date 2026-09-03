import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { Image } from 'expo-image';

import { Text } from '@/components/ui/text';
import { getTierDisplayName, getTierIcon } from '@/constants/rewards';
import { formatTierCashbackRate } from '@/lib/tierCashback';
import { RewardsTier } from '@/lib/types';
import { cn, compactNumberFormat } from '@/lib/utils';

import type { FuseSkipLineTier } from '@/lib/types';

const TIER_SUMMARY: Record<RewardsTier.PRIME | RewardsTier.ULTRA, string> = {
  [RewardsTier.PRIME]: '25% back on AI, streaming & music',
  [RewardsTier.ULTRA]: '50% back on AI, streaming & music',
};

const TIER_MONTHLY_CASHBACK_CAP: Record<RewardsTier.PRIME | RewardsTier.ULTRA, string> = {
  [RewardsTier.PRIME]: '$100/mo cashback',
  [RewardsTier.ULTRA]: '$200/mo cashback',
};

interface BuyFuseTierCardProps {
  currentTier: RewardsTier;
  target?: FuseSkipLineTier;
  progressPct: number;
  reached: boolean;
  onPress: () => void;
}

const TierProgress = ({ percent }: { percent: number }) => {
  const animatedStyle = useAnimatedStyle(
    () => ({ width: withTiming(`${percent}%`, { duration: 350 }) }),
    [percent],
  );

  return (
    <View className="h-[10px] overflow-hidden rounded-xl bg-white/20">
      <Animated.View style={[styles.progressFill, animatedStyle]} />
    </View>
  );
};

/**
 * The Figma tier target card. One press fills the FUSE amount needed for the
 * shown tier; once reached, the next press is used by the parent to advance to
 * the following tier.
 */
export default function BuyFuseTierCard({
  currentTier,
  target,
  progressPct,
  reached,
  onPress,
}: BuyFuseTierCardProps) {
  const currentTierName = getTierDisplayName(currentTier);
  const targetTier = target?.tier;

  if (!target || !targetTier || targetTier === RewardsTier.CORE) {
    return (
      <View className="overflow-hidden rounded-[15px] bg-[#1C1C1C]">
        <View className="rounded-[15px] border border-[#94F27F]/30 bg-[#23321F] px-5 py-[15px]">
          <View className="flex-row items-center justify-between">
            <View>
              <Text className="text-sm font-medium text-white/70">Current tier</Text>
              <Text className="mt-1 text-base font-medium text-white">{currentTierName}</Text>
            </View>
            <View className="rounded-full bg-white/10 px-4 py-3">
              <Text className="text-base font-medium text-white">Top tier</Text>
            </View>
          </View>
          <View className="mt-[14px]">
            <TierProgress percent={100} />
          </View>
        </View>
        <View className="px-5 py-[18px]">
          <Text className="text-base font-medium text-white">All tier benefits unlocked</Text>
          <Text className="mt-1 text-sm font-medium text-white/70">
            Your current membership is already at the highest tier.
          </Text>
        </View>
      </View>
    );
  }

  const targetTierName = getTierDisplayName(targetTier);

  const amountLabel = compactNumberFormat(target.remainingFuse).toUpperCase();
  const benefitSummary = TIER_SUMMARY[targetTier];
  const monthlyCashbackCap = TIER_MONTHLY_CASHBACK_CAP[targetTier];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={
        reached
          ? `Show the tier after ${targetTierName}`
          : `Set amount to ${target.remainingFuse} FUSE for ${targetTierName}`
      }
      onPress={onPress}
      className="overflow-hidden rounded-[15px] bg-[#1C1C1C] active:opacity-80"
      style={styles.shadow}
    >
      <View
        className={cn(
          'rounded-[15px] border px-5 py-[15px]',
          reached ? 'border-[#94F27F]/30 bg-[#23321F]' : 'border-white/10 bg-[#242424]',
        )}
      >
        <View className="flex-row items-center justify-between gap-3">
          <View className="shrink">
            <Text className="text-sm font-medium text-white/70">Current tier</Text>
            <Text className="mt-1 text-base font-medium text-white">{currentTierName}</Text>
          </View>
          <View className="flex-row items-center gap-1.5 rounded-full bg-white/10 px-4 py-3">
            <Text className="text-base font-medium text-white">
              {amountLabel} to {targetTierName}
            </Text>
            <Image
              source={getTierIcon(targetTier)}
              accessibilityLabel={`${targetTierName} tier icon`}
              contentFit="contain"
              tintColor="#FFFFFF"
              style={{ width: 20, height: 20 }}
            />
          </View>
        </View>

        <View className="mt-[14px]">
          <TierProgress percent={progressPct} />
        </View>
      </View>

      <View className="px-5 py-[18px]">
        <Text className="text-base font-medium text-white">
          Unlock {targetTierName} and earn{' '}
          <Text className="text-base font-medium text-[#94F27F]">{monthlyCashbackCap}</Text>
        </Text>
        <Text className="mt-1 text-sm font-medium text-white/70">
          Cashback: {formatTierCashbackRate(targetTier)} {'  |  '} {benefitSummary}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  progressFill: {
    height: '100%',
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
  },
  shadow: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 15,
    elevation: 6,
  },
});
