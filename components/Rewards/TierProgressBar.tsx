import { Image } from 'expo-image';
import { Pressable, View } from 'react-native';
import Animated, { useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { ChevronRightIcon } from 'lucide-react-native';

import { Text } from '@/components/ui/text';
import { getTierIcon } from '@/constants/rewards';
import { RewardsTier } from '@/lib/types';
import { formatNumber, toTitleCase } from '@/lib/utils';
import { useRewards } from '@/store/useRewardsStore';
import { useDimension } from '@/hooks/useDimension';

interface TierProgressBarProps {
  currentTier: RewardsTier;
  currentPoints: number;
  nextTier: RewardsTier | null;
  nextTierPoints: number;
}

const TierProgressBar = ({
  currentTier,
  currentPoints,
  nextTier,
  nextTierPoints,
}: TierProgressBarProps) => {
  const { setSelectedTierModalId } = useRewards();
  const { isScreenMedium } = useDimension();
  const progress = nextTier ? Math.min((currentPoints / nextTierPoints) * 100, 100) : 100;

  const animatedProgress = useAnimatedStyle(() => ({
    width: withTiming(`${progress}%`, { duration: 500 }),
  }));

  const pointsNeeded = nextTier ? Math.max(0, nextTierPoints - currentPoints) : 0;

  return (
    <View className="flex-1 gap-2">
      <View className="h-2.5 w-full overflow-hidden rounded-full bg-rewards/20">
        <Animated.View
          style={[{ backgroundColor: '#FFD151', height: '100%' }, animatedProgress]}
        ></Animated.View>
      </View>
      {nextTier && (
        <View className="flex-row items-center justify-between">
          <Text className="text-base text-rewards/70">{toTitleCase(currentTier)}</Text>
          <View className="flex-row items-center gap-5">
            <View className="flex-row items-center gap-1">
              <Text className="text-base">{formatNumber(pointsNeeded, 0, 0)} more points to</Text>
              <Text className="text-base text-rewards/70">{toTitleCase(nextTier)}</Text>
              <Image
                source={getTierIcon(nextTier)}
                contentFit="contain"
                style={{ width: 16, height: 16 }}
              />
            </View>

            {isScreenMedium && (
              <Pressable
                onPress={() => setSelectedTierModalId(currentTier)}
                className="flex-row items-center hover:opacity-70"
              >
                <Text className="text-base">View benefits</Text>
                <ChevronRightIcon size={16} color="white" />
              </Pressable>
            )}
          </View>
        </View>
      )}
    </View>
  );
};

export default TierProgressBar;
