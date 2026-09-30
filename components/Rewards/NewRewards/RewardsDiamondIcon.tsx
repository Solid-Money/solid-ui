import { useEffect } from 'react';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedProps,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Defs, FeGaussianBlur, Filter, Path } from 'react-native-svg';

const DIAMOND_PATH =
  'M17.3615 16.4614C20.0609 12.8052 21.4106 10.9771 23.4132 9.98852C25.4157 9 27.7693 9 32.4765 9H68.6149C73.3221 9 75.6758 9 77.6782 9.98852C79.6809 10.9771 81.0306 12.8052 83.7298 16.4614L86.4845 20.1922C90.2801 25.3337 92.1782 27.9045 92.0883 30.8025C91.9983 33.7006 89.9439 36.1608 85.835 41.0816L61.5005 70.2252C58.1181 74.2761 56.4267 76.3018 54.4534 77.1764C51.977 78.2745 49.1144 78.2745 46.6379 77.1764C44.6647 76.3018 42.9732 74.2761 39.5908 70.2252L15.2562 41.0816C11.1475 36.1608 9.09315 33.7006 9.00306 30.8025C8.91303 27.9045 10.811 25.3337 14.607 20.1922L17.3615 16.4614Z';
const SLASH_PATH =
  'M36.7081 24.3057L34.4018 27.5856C33.0339 29.531 33.1785 32.0977 34.7572 33.8938L43.6269 43.9852';
const SLASH_LENGTH = 23;
// Exact vectors from the v4 category cashback sheet; other sheets retain their mark.
const CATEGORY_DIAMOND_PATH =
  'M9.36153 8.12458C12.0609 4.63345 13.4106 2.88788 15.4132 1.94394C17.4157 1.00004 19.7693 1.00004 24.4765 1.00004H42.5457H60.6149C65.3221 1.00004 67.6758 1.00004 69.6782 1.94394C71.6809 2.88788 73.0306 4.63345 75.7298 8.12458L78.4845 11.687C82.2801 16.5964 84.1782 19.0511 84.0883 21.8183C83.9983 24.5856 81.9439 26.9347 77.835 31.6333L53.5005 59.4613C50.1181 63.3293 48.4267 65.2636 46.4535 66.0987C43.977 67.1473 41.1144 67.1473 38.6379 66.0987C36.6647 65.2636 34.9732 63.3293 31.5908 59.4613L7.25622 31.6333C3.14749 26.9347 1.09315 24.5856 1.00306 21.8183C0.913026 19.0511 2.811 16.5964 6.607 11.687L9.36153 8.12458Z';
const CATEGORY_SLASH_PATH =
  'M12.2416 9.00007L9.93528 12.1319C8.56738 13.9895 8.71198 16.4403 10.2907 18.1554L19.1604 27.7912';

// The sampled spring easing exported by Figma's category-sheet timeline.
const SCALE_SPRING_SAMPLES = [
  0, 0.0147, 0.0529, 0.1072, 0.1716, 0.2415, 0.3136, 0.3852, 0.4545, 0.5201, 0.5812, 0.6374, 0.6884,
  0.7342, 0.7749, 0.8108, 0.8422, 0.8695, 0.893, 0.913, 0.93, 0.9444, 0.9564, 0.9663, 0.9745,
  0.9811, 0.9865, 0.9908, 0.9941, 0.9968, 0.9988, 1.0002, 1.0013, 1.0021, 1.0025, 1.0028, 1.0029,
  1.003, 1.0029, 1.0027, 1.0026, 1.0024, 1.0022, 1.0019, 1.0017, 1.0015, 1.0013, 1.0012, 1.001,
  1.0009, 1.0007,
];
const figmaScaleEasing = (value: number) => {
  'worklet';
  const position = value * (SCALE_SPRING_SAMPLES.length - 1);
  const index = Math.min(Math.floor(position), SCALE_SPRING_SAMPLES.length - 2);
  const start = SCALE_SPRING_SAMPLES[index];
  return start + (SCALE_SPRING_SAMPLES[index + 1] - start) * (position - index);
};

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
const RewardsDiamondIcon = ({ loop = false }: { loop?: boolean }) => {
  const reduceMotion = useReducedMotion();
  const diamondPath = loop ? CATEGORY_DIAMOND_PATH : DIAMOND_PATH;
  const slashPath = loop ? CATEGORY_SLASH_PATH : SLASH_PATH;
  const diamondTransform = loop ? 'translate(8 8.7)' : undefined;
  const slashTransform = loop ? 'translate(24.5155 15.32)' : undefined;
  const opacity = useSharedValue(0);
  const scale = useSharedValue(0.92);
  const glowOpacity = useSharedValue(0);
  const slashProgress = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) {
      opacity.value = 1;
      scale.value = 1;
      glowOpacity.value = 0;
      slashProgress.value = 1;
      return;
    }
    opacity.value = 0;
    scale.value = 0.92;
    glowOpacity.value = 0;
    slashProgress.value = 0;

    if (loop) {
      const easeOut = Easing.bezier(0, 0, 0.58, 1);
      const easeInOut = Easing.bezier(0.42, 0, 0.58, 1);
      // All four tracks share the two-second loop exported by Figma.
      opacity.value = withRepeat(
        withSequence(
          withTiming(0, { duration: 0 }),
          withDelay(80, withTiming(1, { duration: 440, easing: easeOut })),
          withDelay(1480, withTiming(1, { duration: 0 })),
        ),
        -1,
      );
      scale.value = withRepeat(
        withSequence(
          withTiming(0.92, { duration: 0 }),
          withDelay(80, withTiming(1, { duration: 870, easing: figmaScaleEasing })),
          withDelay(1050, withTiming(1, { duration: 0 })),
        ),
        -1,
      );
      glowOpacity.value = withRepeat(
        withSequence(
          withTiming(0, { duration: 0 }),
          withDelay(620, withTiming(0.5, { duration: 380, easing: easeOut })),
          withTiming(0, { duration: 600, easing: easeInOut }),
          withDelay(400, withTiming(0, { duration: 0 })),
        ),
        -1,
      );
      slashProgress.value = withRepeat(
        withSequence(
          withTiming(0, { duration: 0 }),
          withDelay(520, withTiming(1, { duration: 420, easing: easeOut })),
          withDelay(1060, withTiming(1, { duration: 0 })),
        ),
        -1,
      );
      return () => {
        cancelAnimation(opacity);
        cancelAnimation(scale);
        cancelAnimation(glowOpacity);
        cancelAnimation(slashProgress);
      };
    }

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
  }, [glowOpacity, opacity, scale, slashProgress, loop, reduceMotion]);

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
          d={diamondPath}
          transform={diamondTransform}
          stroke="#D4F2C9"
          strokeWidth={2}
          strokeLinejoin="round"
          filter="url(#diamondGlow)"
        />
        <Path
          d={diamondPath}
          transform={diamondTransform}
          stroke="white"
          strokeWidth={2}
          strokeLinejoin="round"
        />
        <AnimatedPath
          animatedProps={slashProps}
          d={slashPath}
          transform={slashTransform}
          stroke="white"
          strokeOpacity={0.5}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          filter="url(#slashGlow)"
        />
        <AnimatedPath
          animatedProps={slashProps}
          d={slashPath}
          transform={slashTransform}
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
