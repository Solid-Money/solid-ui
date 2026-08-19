import { Pressable, View } from 'react-native';
import Animated, { useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { Check } from 'lucide-react-native';

import { Badge } from '@/components/ui/badge';
import { Image } from '@/components/ui/Image';
import { Text } from '@/components/ui/text';
import { getTierDisplayName } from '@/constants/rewards';
import { getAsset } from '@/lib/assets';
import { formatNumber, formatWholeDollars } from '@/lib/utils';

import { hasSkipTheLine } from './skipTheLine';

import type { FuseSkipLine, FuseSkipLineTier } from '@/lib/types';

/** The brand green, as a literal for props that take a color rather than a class. */
const BRAND_GREEN = '#94F27F';

/** Whole FUSE — the thresholds are five- and six-figure, so decimals are noise. */
const formatFuse = (amount: number) => formatNumber(amount, 0, 0);

/**
 * Filled progress toward a tier's FUSE threshold. Animated on change so a
 * deposit visibly advances the bar rather than snapping.
 */
const ProgressTrack = ({ percent }: { percent: number }) => {
  const clamped = Math.min(100, Math.max(0, percent));

  const animatedProgress = useAnimatedStyle(
    () => ({ width: withTiming(`${clamped}%`, { duration: 500 }) }),
    [clamped],
  );

  return (
    <View className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.08]">
      <Animated.View
        style={[
          { height: '100%', borderRadius: 100, backgroundColor: BRAND_GREEN },
          animatedProgress,
        ]}
      />
    </View>
  );
};

/**
 * One rung of the ladder.
 *
 * An unlocked tier collapses to its price and an "Unlocked" badge — there is no
 * progress left to show. A locked tier trades the badge for the running total
 * and a progress bar.
 */
const SkipLineTierRow = ({
  rung,
  balanceFuse,
  balanceUsd,
}: {
  rung: FuseSkipLineTier;
  balanceFuse: number;
  balanceUsd: number;
}) => {
  const tierName = getTierDisplayName(rung.tier);

  if (rung.unlocked) {
    return (
      <View className="flex-row items-center justify-between px-5 py-4">
        <View className="gap-[3px]">
          <Text className="text-base font-semibold text-white">{tierName}</Text>
          <Text className="text-xs font-medium text-white/[0.45]">
            {formatFuse(rung.requiredFuse)} FUSE
          </Text>
        </View>
        <Badge
          variant="brand"
          className="flex-row items-center gap-1.5 py-1.5 pl-[11px] pr-3"
          accessibilityLabel={`${tierName} unlocked`}
        >
          <Check size={12} color={BRAND_GREEN} strokeWidth={1.9} />
          <Text>Unlocked</Text>
        </Badge>
      </View>
    );
  }

  return (
    <View className="gap-[13px] px-5 py-[18px]">
      <View className="gap-[3px]">
        <Text className="text-base font-semibold text-white">{tierName}</Text>
        {/* Reads "$2,000 128,000 / 400,000 FUSE · 272,000 needed to upgrade" —
            the ratio carries the weight because it's the number that moves. */}
        <Text className="text-xs font-medium text-white/[0.45]">
          {formatWholeDollars(balanceUsd)}{' '}
          <Text className="text-xs font-bold text-white/[0.45]">
            {formatFuse(balanceFuse)} / {formatFuse(rung.requiredFuse)} FUSE
          </Text>{' '}
          · {formatFuse(rung.remainingFuse)} needed to upgrade
        </Text>
      </View>
      <ProgressTrack percent={rung.progressPct} />
    </View>
  );
};

interface SkipTheLineSectionProps {
  skipLine?: FuseSkipLine;
  onAddFuse: () => void;
}

/**
 * "Skip the line" — buy a membership tier with FUSE instead of earning it.
 *
 * Holding FUSE in the soFUSE vault grants Prime or Ultra outright, so this
 * section sits below the points-earned benefits as the shortcut past them. The
 * tier lasts only while the balance holds, which the footnote spells out: this
 * is a deposit, not a purchase.
 *
 * Renders nothing when the mechanic is switched off in admin config.
 */
const SkipTheLineSection = ({ skipLine, onAddFuse }: SkipTheLineSectionProps) => {
  if (!hasSkipTheLine(skipLine)) {
    return null;
  }

  return (
    <View className="gap-[15px] px-4">
      <Text className="text-base text-white/50">Skip the line</Text>

      <View className="overflow-hidden rounded-twice bg-card">
        <View className="flex-row items-center justify-between p-5">
          <View className="flex-1 flex-row items-center gap-3">
            <Image
              source={getAsset('images/fuse-4x.png')}
              style={{ width: 32, height: 32 }}
              contentFit="contain"
            />
            <View className="flex-1 gap-[3px]">
              <Text className="text-base font-semibold text-white">Unlock a tier with FUSE</Text>
              <Text className="text-xs font-medium text-white/[0.45]">
                Deposit FUSE in savings to upgrade your tier
              </Text>
            </View>
          </View>
          <Badge variant="brand" className="ml-2 px-2.5 py-[5px]">
            <Text>New</Text>
          </Badge>
        </View>

        {skipLine.tiers.map(rung => (
          <View key={rung.tier}>
            <View className="h-px bg-white/[0.07]" />
            <SkipLineTierRow
              rung={rung}
              balanceFuse={skipLine.balanceFuse}
              balanceUsd={skipLine.balanceUsd}
            />
          </View>
        ))}
      </View>

      <Pressable
        accessibilityRole="button"
        onPress={onAddFuse}
        className="items-center justify-center rounded-full bg-white py-3.5 transition-all active:scale-95 active:opacity-80"
      >
        <Text className="text-base font-semibold text-black">Add FUSE to your savings</Text>
      </Pressable>

      <Text className="mt-[10px] max-w-[330px] self-center text-center text-xs font-medium leading-[17px] text-white/[0.32]">
        Your tier is held while your FUSE vault balance stays above the threshold.
      </Text>
    </View>
  );
};

export default SkipTheLineSection;
