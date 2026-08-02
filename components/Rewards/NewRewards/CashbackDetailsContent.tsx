import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Defs, FeGaussianBlur, Filter, Path } from 'react-native-svg';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { cn, formatNumber } from '@/lib/utils';

import type { CashbackDetailsData } from './CashbackDetailsSheet.types';

interface CashbackDetailsContentProps extends CashbackDetailsData {
  onGetMoreCashback: () => void;
  animationSession: number;
  /**
   * Bottom-sheet presentation: adds the top padding that clears the sheet's drag
   * handle. False inside a modal, which brings its own padding.
   */
  isSheet?: boolean;
}

const formatWholeDollars = (value: number) => `$${formatNumber(value || 0, 0, 0)}`;

const DIAMOND_PATH =
  'M17.3615 16.4614C20.0609 12.8052 21.4106 10.9771 23.4132 9.98852C25.4157 9 27.7693 9 32.4765 9H68.6149C73.3221 9 75.6758 9 77.6782 9.98852C79.6809 10.9771 81.0306 12.8052 83.7298 16.4614L86.4845 20.1922C90.2801 25.3337 92.1782 27.9045 92.0883 30.8025C91.9983 33.7006 89.9439 36.1608 85.835 41.0816L61.5005 70.2252C58.1181 74.2761 56.4267 76.3018 54.4534 77.1764C51.977 78.2745 49.1144 78.2745 46.6379 77.1764C44.6647 76.3018 42.9732 74.2761 39.5908 70.2252L15.2562 41.0816C11.1475 36.1608 9.09315 33.7006 9.00306 30.8025C8.91303 27.9045 10.811 25.3337 14.607 20.1922L17.3615 16.4614Z';
const SLASH_PATH =
  'M36.7081 24.3057L34.4018 27.5856C33.0339 29.531 33.1785 32.0977 34.7572 33.8938L43.6269 43.9852';
const SLASH_LENGTH = 23;

const AnimatedPath = Animated.createAnimatedComponent(Path);

const CashbackDiamondIcon = () => {
  const opacity = useSharedValue(0);
  const scale = useSharedValue(0.92);
  const glowOpacity = useSharedValue(0);
  const slashProgress = useSharedValue(0);

  useEffect(() => {
    opacity.value = 0;
    scale.value = 0.92;
    glowOpacity.value = 0;
    slashProgress.value = 0;

    opacity.value = withDelay(
      80,
      withTiming(1, { duration: 440, easing: Easing.out(Easing.cubic) }),
    );
    scale.value = withDelay(
      80,
      withTiming(1, {
        duration: 870,
        easing: Easing.bezier(0.16, 1, 0.3, 1),
      }),
    );
    glowOpacity.value = withDelay(
      620,
      withSequence(
        withTiming(0.5, { duration: 380, easing: Easing.out(Easing.cubic) }),
        withTiming(0, { duration: 600, easing: Easing.inOut(Easing.cubic) }),
      ),
    );
    slashProgress.value = withDelay(
      520,
      withTiming(1, { duration: 420, easing: Easing.out(Easing.cubic) }),
    );
  }, [glowOpacity, opacity, scale, slashProgress]);

  const wrapperStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));
  const glowProps = useAnimatedProps(() => ({
    strokeOpacity: glowOpacity.value,
  }));
  const slashProps = useAnimatedProps(() => ({
    opacity: slashProgress.value === 0 ? 0 : 1,
    strokeDasharray: `${slashProgress.value * SLASH_LENGTH} ${SLASH_LENGTH}`,
  }));

  return (
    <Animated.View style={wrapperStyle}>
      <Svg
        width={101.091}
        height={87}
        viewBox="0 0 101.091 87"
        fill="none"
        style={{ overflow: 'visible' }}
      >
        <Defs>
          <Filter id="diamondGlow" x="-40%" y="-40%" width="180%" height="180%">
            <FeGaussianBlur stdDeviation={11} />
          </Filter>
          <Filter id="slashGlow" x="-40%" y="-40%" width="180%" height="180%">
            <FeGaussianBlur stdDeviation={4} />
          </Filter>
        </Defs>
        <AnimatedPath
          animatedProps={glowProps}
          d={DIAMOND_PATH}
          stroke="#D4F2C9"
          strokeWidth={2}
          strokeLinejoin="round"
          filter="url(#diamondGlow)"
        />
        <Path d={DIAMOND_PATH} stroke="white" strokeWidth={2} strokeLinejoin="round" />
        <AnimatedPath
          animatedProps={slashProps}
          d={SLASH_PATH}
          stroke="white"
          strokeOpacity={0.5}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          filter="url(#slashGlow)"
        />
        <AnimatedPath
          animatedProps={slashProps}
          d={SLASH_PATH}
          stroke="white"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    </Animated.View>
  );
};

const CashbackDetailsContent = ({
  cashbackRate,
  cashbackThisMonth,
  maxCashbackMonthly,
  allTimeCashback,
  onGetMoreCashback,
  animationSession,
  isSheet = true,
}: CashbackDetailsContentProps) => (
  <View className={cn('items-center', isSheet && 'px-[34px] pt-[46px]')}>
    <CashbackDiamondIcon key={animationSession} />

    <Text
      className="mt-[31px] text-center text-[30px] text-white"
      style={{ fontFamily: 'MonaSans_600SemiBold', lineHeight: 36 }}
    >
      Cashback
    </Text>
    <Text
      className="mt-[7px] w-[284px] text-center text-base text-white/70"
      style={{ fontFamily: 'MonaSans_400Regular', lineHeight: 18 }}
    >
      Earn USDC back on eligible card spend, up to your monthly limit
    </Text>

    <View className="mt-9 h-44 w-full overflow-hidden rounded-twice bg-[#2B2B2B]">
      <View className="h-[59px] flex-row items-center justify-between px-[19px]">
        <Text className="text-base font-medium text-white/70">Your cashback rate</Text>
        <Text className="text-lg font-bold text-[#94F27F]">
          {formatNumber(cashbackRate || 0, 0, 2)}%
        </Text>
      </View>
      <View className="h-px bg-white/10" />
      <View className="h-[58px] flex-row items-center justify-between px-[19px]">
        <Text className="text-base font-medium text-white/70">Cashback this month</Text>
        <Text className="text-lg font-medium">
          <Text className="text-[#94F27F]">{formatWholeDollars(cashbackThisMonth)}</Text>
          <Text className="text-white"> / {formatWholeDollars(maxCashbackMonthly)}</Text>
        </Text>
      </View>
      <View className="h-px bg-white/10" />
      <View className="flex-1 flex-row items-center justify-between px-[19px]">
        <Text className="text-base font-medium text-white/70">All time cashback</Text>
        <Text className="text-lg font-medium text-white">
          {formatWholeDollars(allTimeCashback)}
        </Text>
      </View>
    </View>

    <Text
      className="mt-7 w-[323px] text-base text-white/70"
      style={{ fontFamily: 'MonaSans_400Regular', lineHeight: 18 }}
    >
      Cashback is credited 14 days after the transaction settles and paid straight into your Savings{' '}
      <Text className="font-bold text-white/70 underline" onPress={onGetMoreCashback}>
        Learn more
      </Text>
    </Text>

    <Button
      variant="brand"
      accessibilityRole="button"
      onPress={onGetMoreCashback}
      className="mt-[35px] w-full transition-all active:scale-95 active:opacity-80"
    >
      <Text className="text-black">Get more cashback</Text>
    </Button>
  </View>
);

export default CashbackDetailsContent;
