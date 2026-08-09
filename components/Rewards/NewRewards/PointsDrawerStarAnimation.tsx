import { useEffect } from 'react';
import Animated, {
  cancelAnimation,
  Easing,
  Extrapolation,
  interpolate,
  useAnimatedProps,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Defs, FeGaussianBlur, Filter, Path } from 'react-native-svg';

// Exact vector geometry exported from Figma node 21843:5832. Rendering the
// glow separately avoids the opaque matte in the old PNG and the inconsistent
// native handling of Figma's generated feComposite drop-shadow filter.
const STAR_PATH =
  'M44.859 10.4137C45.4372 8.52916 48.1051 8.52915 48.6833 10.4137L56.1471 34.7438C56.5363 36.0125 57.5298 37.006 58.7985 37.3952L83.1286 44.859C85.0131 45.4372 85.0131 48.1051 83.1286 48.6833L58.7985 56.1471C57.5298 56.5363 56.5363 57.5298 56.1471 58.7985L48.6833 83.1286C48.1051 85.0131 45.4372 85.0131 44.859 83.1286L37.3952 58.7985C37.006 57.5298 36.0125 56.5363 34.7438 56.1471L10.4137 48.6833C8.52916 48.1051 8.52915 45.4372 10.4137 44.859L34.7438 37.3952C36.0125 37.006 37.006 36.0125 37.3952 34.7438L44.859 10.4137Z';

const MOTION_DURATION_MS = 2000;
const SCALE_START = 0.04;
const SCALE_END = 0.49;
const SCALE_FROM = 0.78;
const SCALE_TO = 1;

// Figma 21843:5832 exports this sampled spring as a CSS linear() easing.
// Keeping its samples preserves the tiny overshoot instead of flattening the
// motion into a cubic bezier.
const SCALE_EASING_SAMPLES = [
  0, 0.0163, 0.0587, 0.1189, 0.1902, 0.2676, 0.3468, 0.4251, 0.5002, 0.5707, 0.6356, 0.6944, 0.7469,
  0.7931, 0.8334, 0.8681, 0.8975, 0.9223, 0.9428, 0.9596, 0.9731, 0.9839, 0.9922, 0.9986, 1.0033,
  1.0067, 1.0089, 1.0103, 1.0109, 1.0111, 1.0109, 1.0104, 1.0097, 1.0089, 1.008, 1.0071, 1.0063,
  1.0054, 1.0047, 1.004, 1.0033, 1.0027, 1.0022, 1.0018, 1.0014, 1.0011, 1.0008, 1.0006, 1.0004,
  1.0003, 1.0002,
];
const SCALE_INPUT_RANGE = SCALE_EASING_SAMPLES.map(
  (_, index) =>
    SCALE_START + ((SCALE_END - SCALE_START) * index) / (SCALE_EASING_SAMPLES.length - 1),
);
const SCALE_OUTPUT_RANGE = SCALE_EASING_SAMPLES.map(
  value => SCALE_FROM + (SCALE_TO - SCALE_FROM) * value,
);

const EASE_OUT = Easing.bezier(0, 0, 0.58, 1).factory();
const EASE_IN_OUT = Easing.bezier(0.42, 0, 0.58, 1).factory();
const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedGaussianBlur = Animated.createAnimatedComponent(FeGaussianBlur);

const getPhase = (progress: number, start: number, end: number) => {
  'worklet';

  return Math.min(1, Math.max(0, (progress - start) / (end - start)));
};

const getGlowValue = (timeline: number, minimum: number, maximum: number) => {
  'worklet';

  if (timeline < 0.15) return minimum;
  if (timeline < 0.525) {
    return minimum + (maximum - minimum) * EASE_OUT(getPhase(timeline, 0.15, 0.525));
  }
  if (timeline < 0.875) {
    return maximum + (minimum - maximum) * EASE_IN_OUT(getPhase(timeline, 0.525, 0.875));
  }
  return minimum;
};

/** Figma's transparent, display-synced 2s star animation from node 21843:5832. */
const PointsDrawerStarAnimation = () => {
  const reduceMotion = useReducedMotion();
  const progress = useSharedValue(reduceMotion ? 1 : 0);

  useEffect(() => {
    cancelAnimation(progress);
    progress.value = reduceMotion ? 1 : 0;

    if (!reduceMotion) {
      progress.value = withTiming(1, {
        duration: MOTION_DURATION_MS,
        easing: Easing.linear,
      });
    }

    return () => cancelAnimation(progress);
  }, [progress, reduceMotion]);

  const animatedStyle = useAnimatedStyle(() => {
    const timeline = progress.value;

    const opacity =
      timeline < 0.04 ? 0 : timeline < 0.275 ? EASE_OUT(getPhase(timeline, 0.04, 0.275)) : 1;
    const rotate =
      timeline < 0.04
        ? 90
        : timeline < 0.51
          ? 90 * (1 - EASE_IN_OUT(getPhase(timeline, 0.04, 0.51)))
          : 0;
    const scale =
      timeline < SCALE_START
        ? SCALE_FROM
        : timeline >= SCALE_END
          ? SCALE_TO
          : interpolate(timeline, SCALE_INPUT_RANGE, SCALE_OUTPUT_RANGE, Extrapolation.CLAMP);

    return {
      opacity,
      transform: [{ rotate: `${rotate}deg` }, { scale }],
    };
  });

  const glowPathProps = useAnimatedProps(() => ({
    strokeOpacity: getGlowValue(progress.value, 0.5, 0.95),
  }));
  const glowBlurProps = useAnimatedProps(() => ({
    // Figma's SVG exporter maps an 8px shadow radius to stdDeviation=4.
    stdDeviation: getGlowValue(progress.value, 4, 12.8),
  }));

  return (
    <Animated.View
      style={[
        {
          width: 94,
          height: 94,
        },
        animatedStyle,
      ]}
    >
      <Svg
        pointerEvents="none"
        width={94}
        height={94}
        viewBox="0 0 93.5423 93.5423"
        fill="none"
        style={{ overflow: 'visible' }}
      >
        <Defs>
          <Filter id="pointsDrawerStarGlow" x="-60%" y="-60%" width="220%" height="220%">
            <AnimatedGaussianBlur animatedProps={glowBlurProps} />
          </Filter>
        </Defs>
        <AnimatedPath
          animatedProps={glowPathProps}
          d={STAR_PATH}
          fill="none"
          stroke="white"
          strokeWidth={2}
          filter="url(#pointsDrawerStarGlow)"
        />
        <Path d={STAR_PATH} fill="none" stroke="white" strokeWidth={2} />
      </Svg>
    </Animated.View>
  );
};

export default PointsDrawerStarAnimation;
