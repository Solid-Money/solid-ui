import { ReactNode, useState } from 'react';
import { LayoutChangeEvent, Platform, View } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { path } from '@/constants/path';
import { getTierDisplayName, getTierIcon } from '@/constants/rewards';
import { useMaxAPY } from '@/hooks/useAnalytics';
import { useTierBenefits } from '@/hooks/useRewards';
import { getAsset } from '@/lib/assets';
import { RewardsTier, TierBenefits } from '@/lib/types';
import { compactNumberFormat, formatNumber } from '@/lib/utils';

import RewardBenefit from './RewardBenefit';
import RewardComingSoon from './RewardComingSoon';
import TierProgressBar from './TierProgressBar';

// The rewards hero star is a single decorative image that scales fluidly with
// the card. Sizing and positioning it from the measured card area — instead of
// swapping between two fixed desktop/mobile layouts at the `md` breakpoint —
// keeps it anchored to the right so it never snaps between versions or slides
// over the tier/points content at intermediate tablet widths.
const STAR_ASPECT_RATIO = 839 / 386; // native pixel ratio of points_large.png
const STAR_WIDTH_RATIO = 0.66; // fraction of the card width the star image spans
const STAR_MIN_WIDTH = 340; // keep the star visible on the narrowest screens
const STAR_MAX_WIDTH = 760; // cap the star on very wide cards
const STAR_TOP_BLEED_RATIO = 0.4; // how far the (mostly transparent) image bleeds past the top edge
const STAR_RIGHT_INSET_RATIO = 0.08; // keep a small gap from the right edge

// Transform API tier benefits to display items with dynamic icons
interface DashboardBenefitItem {
  icon?: string;
  iconText?: string;
  title: string;
  description: string;
  descriptionNode?: ReactNode;
}

const transformTierBenefitsForDashboard = (
  tierBenefits: TierBenefits | undefined,
  currentTier: RewardsTier,
  coreDepositTitle: string | undefined,
): DashboardBenefitItem[] => {
  if (!tierBenefits) {
    return [];
  }

  const depositTitle =
    currentTier === RewardsTier.CORE && coreDepositTitle != null
      ? coreDepositTitle
      : tierBenefits.depositBoost.title;

  return [
    {
      icon: 'images/dollar-yellow.png',
      title: depositTitle,
      description: 'On your savings',
      descriptionNode: currentTier !== RewardsTier.CORE ? <RewardComingSoon /> : undefined,
    },
    {
      iconText: tierBenefits.cardCashback.title, // e.g., "2%", "3%", "5%"
      title: `${tierBenefits.cardCashback.title} Cashback`,
      description: 'for every purchase',
    },
    {
      icon: 'images/rocket-yellow.png',
      title: 'Free virtual card',
      description: '200M+ Visa merchants',
    },
  ];
};

interface RewardsDashboardProps {
  currentTier: RewardsTier;
  totalPoints: number;
  nextTier: RewardsTier | null;
  nextTierPoints: number;
  onTierPress: () => void;
}

const RewardsDashboard = ({
  currentTier,
  totalPoints,
  nextTier,
  nextTierPoints,
}: RewardsDashboardProps) => {
  const [starArea, setStarArea] = useState({ width: 0, height: 0 });
  const { data: allTierBenefits } = useTierBenefits();
  const { maxAPY } = useMaxAPY();

  // Star dimensions derived from the measured card area (see constants above).
  const starWidth = Math.min(
    STAR_MAX_WIDTH,
    Math.max(STAR_MIN_WIDTH, starArea.width * STAR_WIDTH_RATIO),
  );
  const starHeight = starWidth / STAR_ASPECT_RATIO;

  const handleStarAreaLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setStarArea(prev => (prev.width === width && prev.height === height ? prev : { width, height }));
  };

  // Get benefits for the current tier from API data
  const currentTierBenefits = allTierBenefits?.find(tb => tb.tier === currentTier);
  const coreDepositTitle =
    currentTier === RewardsTier.CORE
      ? maxAPY !== null
        ? `${formatNumber(maxAPY, 2, 0)}% yield`
        : undefined
      : undefined;
  const dashboardBenefits = transformTierBenefitsForDashboard(
    currentTierBenefits,
    currentTier,
    coreDepositTitle,
  );

  return (
    <View
      className="relative gap-10 rounded-twice p-6 md:gap-20 md:px-10 md:py-8"
      style={Platform.OS === 'web' ? {} : { borderRadius: 20 }}
    >
      <LinearGradient
        colors={['rgba(255, 209, 81, 1)', 'rgba(255, 209, 81, 0.4)']}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.6, y: 1 }}
        pointerEvents="none"
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 0,
          bottom: 0,
          zIndex: -1,
          opacity: 0.15,
          borderRadius: 20,
        }}
      />
      <View
        pointerEvents="none"
        onLayout={handleStarAreaLayout}
        style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, zIndex: -1 }}
      >
        {starArea.width > 0 && (
          <Image
            source={getAsset('images/points_large.png')}
            contentFit="contain"
            style={{
              position: 'absolute',
              width: starWidth,
              height: starHeight,
              right: -starWidth * STAR_RIGHT_INSET_RATIO,
              top: -starHeight * STAR_TOP_BLEED_RATIO,
            }}
          />
        )}
      </View>
      <View className="relative flex-row justify-between">
        <View className="flex-1 justify-between gap-12 md:flex-[0.7]">
          <View className="justify-between gap-4 md:flex-row">
            <View className="gap-4 md:flex-row md:gap-20">
              <View>
                <Text className="text-rewards/70 md:text-lg">Your tier</Text>
                <View className="flex-row items-center gap-2">
                  <Text className="text-4.5xl font-semibold text-rewards">
                    {getTierDisplayName(currentTier)}
                  </Text>
                  <Image
                    source={getTierIcon(currentTier)}
                    contentFit="contain"
                    style={{ width: 24, height: 24 }}
                  />
                </View>
              </View>
              <View>
                <Text className="text-rewards/70 md:text-lg">Total points</Text>
                <Text className="text-4.5xl font-semibold text-rewards">
                  {compactNumberFormat(totalPoints)}
                </Text>
              </View>
            </View>
          </View>

          <TierProgressBar
            currentTier={currentTier}
            currentPoints={totalPoints}
            nextTier={nextTier}
            nextTierPoints={nextTierPoints}
          />
        </View>
      </View>
      <View className="gap-6 md:gap-10">
        <View className="flex-row items-center justify-between">
          <Text className="text-lg font-medium text-rewards/70">Your top benefits</Text>
        </View>
        <View className="flex-row flex-wrap items-center justify-between gap-6 md:gap-2">
          {dashboardBenefits.map((benefit, index) => (
            <RewardBenefit
              key={index}
              icon={benefit.icon}
              iconText={benefit.iconText}
              title={benefit.title}
              description={benefit.description}
              descriptionNode={benefit.descriptionNode}
            />
          ))}

          <Button
            variant="rewards"
            className="h-11 w-full rounded-xl md:w-52"
            onPress={() => router.push(path.REWARDS_BENEFITS)}
          >
            <Text className="text-base font-bold text-primary">View all benefits</Text>
          </Button>
        </View>
      </View>
    </View>
  );
};

export default RewardsDashboard;
