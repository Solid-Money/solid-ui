import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { Image } from 'expo-image';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';

const POINTS_STAR = require('@/assets/images/rewards-tiers/points-drawer-star.png');
const POINTS_SAVE = require('@/assets/images/rewards-tiers/points-save.png');
const POINTS_SPEND = require('@/assets/images/rewards-tiers/points-spend.png');
const POINTS_INVITE = require('@/assets/images/rewards-tiers/points-invite.png');
const POINTS_SWAP = require('@/assets/images/rewards-tiers/points-swap.png');

interface TierPointsSheetContentProps {
  animationSession: number;
  onClose: () => void;
}

interface PointsMethod {
  title: string;
  description: string;
  icon: number;
}

const POINTS_METHODS: PointsMethod[] = [
  {
    title: 'Save',
    description: '1 point/hour for\nevery $1 deposited',
    icon: POINTS_SAVE,
  },
  {
    title: 'Spend',
    description: '1 point per\n$1 spent',
    icon: POINTS_SPEND,
  },
  {
    title: 'Invite friends',
    description: 'Earn 10% of their\ndaily points',
    icon: POINTS_INVITE,
  },
  {
    title: 'Swap',
    description: '1 point per\n$1 swapped',
    icon: POINTS_SWAP,
  },
];

const AnimatedTierStar = () => {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = 0;
    progress.value = withTiming(1, {
      duration: 2000,
      easing: Easing.linear,
    });
  }, [progress]);

  const animatedStyle = useAnimatedStyle(() => {
    const opacity = interpolate(
      progress.value,
      [0, 0.04, 0.275, 1],
      [0, 0, 1, 1],
      Extrapolation.CLAMP,
    );
    const rotate = interpolate(
      progress.value,
      [0, 0.04, 0.51, 1],
      [90, 90, 0, 0],
      Extrapolation.CLAMP,
    );
    const scale = interpolate(
      progress.value,
      [0, 0.04, 0.49, 1],
      [0.78, 0.78, 1, 1],
      Extrapolation.CLAMP,
    );
    const glow = interpolate(
      progress.value,
      [0, 0.15, 0.525, 0.875, 1],
      [0.5, 0.5, 0.95, 0.5, 0.5],
      Extrapolation.CLAMP,
    );

    return {
      opacity,
      shadowOpacity: glow,
      shadowRadius: 8 + glow * 18,
      transform: [{ rotate: `${rotate}deg` }, { scale }],
    };
  });

  return (
    <Animated.View
      style={[
        {
          width: 94,
          height: 94,
          shadowColor: '#ffffff',
          shadowOffset: { width: 0, height: 0 },
        },
        animatedStyle,
      ]}
    >
      <Image source={POINTS_STAR} style={{ width: 94, height: 94 }} contentFit="contain" />
    </Animated.View>
  );
};

const PointsCell = ({ method, bottom }: { method: PointsMethod; bottom?: boolean }) => (
  <View
    className="w-1/2 items-center"
    style={{
      height: bottom ? 177 : 169,
      paddingTop: bottom ? 31 : 23,
    }}
  >
    <Image source={method.icon} style={{ width: 50, height: 50 }} contentFit="contain" />
    <Text
      className="mt-2 text-center text-white"
      style={{
        fontFamily: 'MonaSans_600SemiBold',
        fontSize: 16,
        lineHeight: 17,
      }}
    >
      {method.title}
    </Text>
    <Text
      className="mt-1 text-center text-white/70"
      style={{
        fontFamily: 'MonaSans_500Medium',
        fontSize: 14,
        lineHeight: 17,
      }}
    >
      {method.description}
    </Text>
  </View>
);

const TierPointsSheetContent = ({ animationSession, onClose }: TierPointsSheetContentProps) => (
  <View className="items-center px-[34px] pt-[46px]">
    <AnimatedTierStar key={animationSession} />

    <Text
      className="mt-[31px] w-[219px] text-center text-white"
      style={{
        fontFamily: 'MonaSans_600SemiBold',
        fontSize: 30,
        lineHeight: 30,
      }}
    >
      How do you{'\n'}earn points?
    </Text>
    <Text
      className="mt-[10px] w-[284px] text-center text-white/70"
      style={{
        fontFamily: 'MonaSans_400Regular',
        fontSize: 16,
        lineHeight: 18,
      }}
    >
      Earn points for every action you take with Solid and unlock rewards
    </Text>

    <View className="mt-9 h-[346px] w-full overflow-hidden rounded-[23px] bg-[#2B2B2B]">
      <View className="flex-row">
        <PointsCell method={POINTS_METHODS[0]} />
        <PointsCell method={POINTS_METHODS[1]} />
      </View>
      <View className="h-px bg-white/10" />
      <View className="flex-row">
        <PointsCell method={POINTS_METHODS[2]} bottom />
        <PointsCell method={POINTS_METHODS[3]} bottom />
      </View>
      <View className="absolute bottom-0 left-1/2 top-0 w-px bg-white/10" />
    </View>

    <Button
      variant="brand"
      accessibilityRole="button"
      accessibilityLabel="Close points information"
      onPress={onClose}
      className="mt-[31px] w-full transition-all active:scale-95 active:opacity-80"
    >
      <Text
        className="text-center text-black"
        style={{
          fontFamily: 'MonaSans_600SemiBold',
          fontSize: 16,
          lineHeight: 20,
        }}
      >
        Close
      </Text>
    </Button>
  </View>
);

export default TierPointsSheetContent;
