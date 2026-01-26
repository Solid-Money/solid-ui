import { ImageBackground, Platform, View } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { path } from '@/constants/path';
import { getTierDisplayName, getTierIcon, TIER_BENEFITS } from '@/constants/rewards';
import { useDimension } from '@/hooks/useDimension';
import { getAsset } from '@/lib/assets';
import { RewardsTier } from '@/lib/types';
import { formatNumber } from '@/lib/utils';

import RewardBenefit from './RewardBenefit';
import TierProgressBar from './TierProgressBar';

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
  onTierPress,
}: RewardsDashboardProps) => {
  const { isScreenMedium } = useDimension();

  return (
    <View
      className="relative gap-20 rounded-twice p-6 md:px-10 md:py-8"
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
      {!isScreenMedium && (
        <ImageBackground
          source={getAsset('images/points_large.png')}
          resizeMode="contain"
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: 0,
            bottom: 0,
            zIndex: 0,
            pointerEvents: 'none',
          }}
          imageStyle={{
            width: 800,
            height: 600,
            marginTop: isScreenMedium ? -120 : -180,
            marginRight: isScreenMedium ? -120 : -300,
            marginLeft: 'auto',
          }}
        />
      )}
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
                  {formatNumber(totalPoints, 0, 0)}
                </Text>
              </View>
            </View>
            <View className="justify-center">
              <Button variant="rewards" className="h-11 w-40 rounded-xl" onPress={onTierPress}>
                <Text className="text-base font-bold text-primary">View activity</Text>
              </Button>
            </View>
          </View>

          <TierProgressBar
            currentTier={currentTier}
            currentPoints={totalPoints}
            nextTier={nextTier}
            nextTierPoints={nextTierPoints}
          />
        </View>

        {isScreenMedium && (
          <View className="pointer-events-none absolute -right-[55%] top-[45%] flex-[0.3] -translate-x-1/2 -translate-y-1/2">
            <Image
              source={getAsset('images/points_large.png')}
              contentFit="contain"
              style={{ width: 800, height: 600 }}
            />
          </View>
        )}
      </View>
      <View className="gap-6 md:gap-10">
        <View className="flex-row items-center justify-between">
          <Text className="text-lg font-medium text-rewards/70">Your top benefits</Text>
        </View>
        <View className="flex-row flex-wrap items-center justify-between gap-6 md:gap-2">
          {TIER_BENEFITS[currentTier].map(benefit => (
            <RewardBenefit
              key={benefit.icon}
              icon={benefit.icon}
              title={benefit.title}
              description={benefit.description}
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
