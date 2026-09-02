import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, withTiming } from 'react-native-reanimated';

import { Image } from '@/components/ui/Image';
import { Text } from '@/components/ui/text';
import { getTierDisplayName } from '@/constants/rewards';
import { getAsset } from '@/lib/assets';
import { compactNumberFormat } from '@/lib/utils';

import type { FuseSkipLine, RewardsTier } from '@/lib/types';

const clampProgress = (currentPoints: number, targetPoints: number) => {
  if (targetPoints <= 0) return 0;
  return Math.min(100, Math.max(0, (currentPoints / targetPoints) * 100));
};

const formatPoints = (points: number) =>
  new Intl.NumberFormat('en-US', {
    notation: 'compact',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(points);

const PointsProgress = ({ percent }: { percent: number }) => {
  const animatedProgress = useAnimatedStyle(
    () => ({ width: withTiming(`${percent}%`, { duration: 500 }) }),
    [percent],
  );

  return (
    <View className="h-[10px] flex-1 overflow-hidden rounded-xl bg-white/20">
      <Animated.View className="h-full rounded-xl bg-white" style={animatedProgress} />
    </View>
  );
};

interface TierUpgradeCardProps {
  currentPoints: number;
  targetPoints: number;
  nextTier: RewardsTier | null;
  skipLine?: FuseSkipLine;
  onUpgradeTier: () => void;
}

/**
 * One compact choice card for both paths to the next tier: earn points by using
 * Solid, or reach the same tier immediately by holding FUSE in Savings.
 *
 * The FUSE shortcut is backend-configured. If the next points tier has no
 * matching FUSE threshold, there is no truthful shortcut to advertise, so the
 * card stays hidden.
 */
const TierUpgradeCard = ({
  currentPoints,
  targetPoints,
  nextTier,
  skipLine,
  onUpgradeTier,
}: TierUpgradeCardProps) => {
  const fuseTier = nextTier ? skipLine?.tiers.find(rung => rung.tier === nextTier) : undefined;

  if (!nextTier || !fuseTier) {
    return null;
  }

  const tierName = getTierDisplayName(nextTier);
  const pointsRemaining = Math.max(0, targetPoints - currentPoints);
  const progress = clampProgress(currentPoints, targetPoints);

  return (
    <View className="min-h-[306px] overflow-hidden rounded-[23px] bg-[#1C1C1C] px-5 pb-[17px] pt-[17px]">
      <Text className="font-bold text-white" style={styles.title}>
        Earn points
      </Text>
      <Text className="mt-1 text-white/70" style={styles.body}>
        Get to the next tier for free just by using the app
      </Text>

      <View className="mt-4 flex-row items-center gap-[10px]">
        <PointsProgress percent={progress} />
        <Text className="text-white" style={styles.progressValue}>
          {formatPoints(currentPoints)}
          <Text className="text-white/70" style={styles.progressTarget}>
            /{formatPoints(targetPoints)}
          </Text>
        </Text>
      </View>

      <View className="mt-[9px] flex-row items-center gap-1">
        <Text className="font-medium text-white" style={styles.pointsRemaining}>
          {formatPoints(pointsRemaining)} more points to {tierName}
        </Text>
        <Image
          source={getAsset('images/rewards-points-star.svg')}
          style={{ width: 16, height: 16 }}
          contentFit="contain"
        />
      </View>

      <View className="-mx-5 mt-[15px] flex-row items-center gap-4">
        <View className="h-px flex-1 bg-white/10" />
        <Text className="text-white/50" style={styles.orLabel}>
          Or
        </Text>
        <View className="h-px flex-1 bg-white/10" />
      </View>

      <Text className="mt-[9px] font-bold text-white" style={styles.title}>
        Skip the line with FUSE
      </Text>
      <Text className="mt-[3px] text-white/70" style={styles.body}>
        Deposit {compactNumberFormat(fuseTier.requiredFuse)} FUSE to saving and unlock the{' '}
        {tierName} tier now!
      </Text>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Upgrade to ${tierName} with FUSE`}
        onPress={onUpgradeTier}
        className="mt-[18px] h-[35px] w-[129px] items-center justify-center self-start rounded-full bg-[#94F27F] transition-all active:scale-95 active:opacity-80"
      >
        <Text className="font-semibold text-black" style={styles.buttonLabel}>
          Upgrade tier
        </Text>
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  title: {
    color: '#FFFFFF',
    fontFamily: 'MonaSans_700Bold',
    fontSize: 18,
    lineHeight: 22,
  },
  body: {
    color: 'rgba(255,255,255,0.7)',
    fontFamily: 'MonaSans_400Regular',
    fontSize: 14,
    lineHeight: 20,
  },
  progressValue: {
    color: '#FFFFFF',
    fontFamily: 'MonaSans_400Regular',
    fontSize: 16,
    lineHeight: 20,
  },
  progressTarget: {
    color: 'rgba(255,255,255,0.7)',
    fontFamily: 'MonaSans_400Regular',
    fontSize: 16,
    lineHeight: 20,
  },
  pointsRemaining: {
    color: '#FFFFFF',
    fontFamily: 'MonaSans_500Medium',
    fontSize: 16,
    lineHeight: 20,
  },
  orLabel: {
    color: 'rgba(255,255,255,0.5)',
    fontFamily: 'MonaSans_400Regular',
    fontSize: 14,
    lineHeight: 18,
  },
  buttonLabel: {
    color: '#000000',
    fontFamily: 'MonaSans_600SemiBold',
    fontSize: 16,
    lineHeight: 20,
  },
});

export default TierUpgradeCard;
