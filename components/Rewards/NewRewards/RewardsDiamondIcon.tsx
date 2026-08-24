import { useEffect } from 'react';
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

const DIAMOND_PATH =
  'M17.3615 16.4614C20.0609 12.8052 21.4106 10.9771 23.4132 9.98852C25.4157 9 27.7693 9 32.4765 9H68.6149C73.3221 9 75.6758 9 77.6782 9.98852C79.6809 10.9771 81.0306 12.8052 83.7298 16.4614L86.4845 20.1922C90.2801 25.3337 92.1782 27.9045 92.0883 30.8025C91.9983 33.7006 89.9439 36.1608 85.835 41.0816L61.5005 70.2252C58.1181 74.2761 56.4267 76.3018 54.4534 77.1764C51.977 78.2745 49.1144 78.2745 46.6379 77.1764C44.6647 76.3018 42.9732 74.2761 39.5908 70.2252L15.2562 41.0816C11.1475 36.1608 9.09315 33.7006 9.00306 30.8025C8.91303 27.9045 10.811 25.3337 14.607 20.1922L17.3615 16.4614Z';
const SLASH_PATH =
  'M36.7081 24.3057L34.4018 27.5856C33.0339 29.531 33.1785 32.0977 34.7572 33.8938L43.6269 43.9852';
const SLASH_LENGTH = 23;

const AnimatedPath = Animated.createAnimatedComponent(Path);

/**
 * The outlined Solid diamond that heads every rewards details sheet — cashback,
 * subscription cashback and yield boost all open on the same mark. It draws
 * itself in on mount: the diamond fades and scales up, its slash strokes on,
 * and a soft green glow pulses once behind the outline.
 *
 * Remount it to replay the animation — the sheets bump an `animationSession`
 * key each time they open.
 */
const RewardsDiamondIcon = () => {
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

export default RewardsDiamondIcon;
