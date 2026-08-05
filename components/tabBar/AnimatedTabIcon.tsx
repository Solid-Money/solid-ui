import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  interpolateColor,
  useAnimatedProps,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

export type AnimatedTabIconName = 'wallet' | 'savings' | 'rewards';

interface AnimatedTabIconProps {
  name: AnimatedTabIconName;
  focused: boolean;
  /** The tab-bar icon slot; the Figma glyph stays 24px inside it. */
  size?: number;
}

const ICON_SIZE = 24;
const ANIMATION_DURATION_MS = 2000;
const OUTLINE_COLOR = '#999999';
const ACTIVE_COLOR = '#FFFFFF';
const REWARDS_DETAIL_COLOR = '#111111';

const WALLET_PATH =
  'M20.3678 9.67473L13.278 3.64654C12.5297 3.01036 11.4303 3.01158 10.6835 3.64943L3.6288 9.67492C3.18392 10.0549 2.92772 10.6106 2.92772 11.1957V19.4575C2.92772 20.5621 3.82316 21.4575 4.92772 21.4575H8.96988V16.7959C8.96988 15.6913 9.86531 14.7959 10.9699 14.7959H13.0428C14.1473 14.7959 15.0428 15.6913 15.0428 16.7959V21.4575H19.0723C20.1768 21.4575 21.0723 20.5621 21.0723 19.4575V11.1984C21.0723 10.6118 20.8147 10.0547 20.3678 9.67473Z';

const SAVINGS_PATH =
  'M10.9323 0.750409H5.57485C5.40779 0.750409 5.32425 0.750409 5.25051 0.775848C5.18529 0.798337 5.12589 0.83505 5.07661 0.883323C5.02088 0.937907 4.98352 1.01262 4.9088 1.16205L0.999303 8.98103C0.820881 9.33791 0.73167 9.51635 0.753098 9.66137C0.771808 9.78796 0.841862 9.90134 0.946767 9.97469C1.06691 10.0587 1.26639 10.0587 1.66535 10.0587H7.44169L4.64921 19.3671L15.9989 7.59698C16.3819 7.19988 16.5733 7.00133 16.5845 6.83143C16.5942 6.68397 16.5333 6.54065 16.4204 6.44528C16.2904 6.33541 16.0146 6.33541 15.4629 6.33541H8.83794L10.9323 0.750409Z';

const REWARDS_OUTLINE_PATH =
  'M17.278 5.69833L9.25022 10.25M9.25022 10.25L1.22241 5.69833M9.25022 10.25V19.4068M5.00022 3.02092L13.5002 7.8403M17.7502 14.8966L9.98405 19.4726C9.7162 19.6246 9.58228 19.7004 9.44052 19.7302C9.31491 19.7566 9.18552 19.7566 9.06 19.7302C8.91815 19.7004 8.78423 19.6246 8.51638 19.4726L1.52746 15.5101C1.24459 15.3497 1.10314 15.2695 1.00014 15.1554C0.909033 15.0545 0.840079 14.9349 0.797891 14.8046C0.750215 14.6573 0.750215 14.4922 0.750215 14.1619V6.33805C0.750215 6.00779 0.750215 5.84266 0.797891 5.69538C0.840079 5.56508 0.909033 5.44548 1.00014 5.34458C1.10314 5.23051 1.24458 5.15032 1.52746 4.98993L8.51638 1.02733C8.78423 0.875465 8.91815 0.799531 9.06 0.769757C9.18552 0.743414 9.31491 0.743414 9.44052 0.769757C9.58228 0.799531 9.7162 0.875465 9.98405 1.02733L16.9729 4.98993C17.2559 5.15032 17.3973 5.23051 17.5003 5.34458C17.5914 5.44548 17.6604 5.56508 17.7025 5.69538C17.7502 5.84266 17.7502 6.00779 17.7502 6.33805V14.8966Z';

const REWARDS_DETAIL_PATH =
  'M17.278 5.69833L9.25022 10.25M9.25022 10.25L1.22241 5.69833M9.25022 10.25V19.4068M5.00022 3.02092L13.5002 7.8403';

const REWARDS_FILL_PATH =
  'M17.7502 14.8966L9.98405 19.4726C9.7162 19.6246 9.58228 19.7004 9.44052 19.7302C9.31491 19.7566 9.18552 19.7566 9.06 19.7302C8.91815 19.7004 8.78423 19.6246 8.51638 19.4726L1.52746 15.5101C1.24459 15.3497 1.10314 15.2695 1.00014 15.1554C0.909033 15.0545 0.840079 14.9349 0.797891 14.8046C0.750215 14.6573 0.750215 14.4922 0.750215 14.1619V6.33805C0.750215 6.00779 0.750215 5.84266 0.797891 5.69538C0.840079 5.56508 0.909033 5.44548 1.00014 5.34458C1.10314 5.23051 1.24458 5.15032 1.52746 4.98993L8.51638 1.02733C8.78423 0.875465 8.91815 0.799531 9.06 0.769757C9.18552 0.743414 9.31491 0.743414 9.44052 0.769757C9.58228 0.799531 9.7162 0.875465 9.98405 1.02733L16.9729 4.98993C17.2559 5.15032 17.3973 5.23051 17.5003 5.34458C17.5914 5.44548 17.6604 5.56508 17.7025 5.69538C17.7502 5.84266 17.7502 6.00779 17.7502 6.33805V14.8966Z';

const AnimatedPath = Animated.createAnimatedComponent(Path);

const LINEAR = 0;
const EASE_IN_OUT = 1;
const EASE_OUT = 2;

type EasingKind = typeof LINEAR | typeof EASE_IN_OUT | typeof EASE_OUT;

const easeInOut = Easing.bezier(0.42, 0, 0.58, 1).factory();
const easeOut = Easing.bezier(0, 0, 0.58, 1).factory();

const WALLET_SCALE_TIMES = [0, 0.06, 0.131, 0.21, 0.3335, 1] as const;
const WALLET_SCALE_VALUES = [1, 0.926, 1.035, 0.992, 0.998, 0.998] as const;
const WALLET_SCALE_EASINGS = [EASE_IN_OUT, EASE_IN_OUT, EASE_IN_OUT, EASE_OUT, LINEAR] as const;

const SAVINGS_SCALE_TIMES = [0, 0.0375, 0.0915, 0.17, 0.26, 0.3335, 1] as const;
const SAVINGS_SCALE_VALUES = [1, 0.935, 1.071, 0.993, 1.002, 0.999, 0.999] as const;
const SAVINGS_SCALE_EASINGS = [
  EASE_IN_OUT,
  EASE_IN_OUT,
  EASE_IN_OUT,
  EASE_IN_OUT,
  EASE_OUT,
  LINEAR,
] as const;

const SAVINGS_ROTATE_TIMES = [0, 0.0215, 0.0755, 0.102, 1] as const;
const SAVINGS_ROTATE_VALUES = [0, 0, 5, 0, 0] as const;
const SAVINGS_ROTATE_EASINGS = [LINEAR, EASE_OUT, EASE_OUT, LINEAR] as const;

const applyEasing = (progress: number, easing: EasingKind) => {
  'worklet';

  if (easing === EASE_IN_OUT) return easeInOut(progress);
  if (easing === EASE_OUT) return easeOut(progress);
  return progress;
};

const interpolateKeyframes = (
  progress: number,
  times: readonly number[],
  values: readonly number[],
  easings: readonly EasingKind[],
) => {
  'worklet';

  if (progress <= times[0]) return values[0];

  for (let index = 0; index < times.length - 1; index += 1) {
    const start = times[index];
    const end = times[index + 1];

    if (progress <= end) {
      const segmentProgress = Math.min(Math.max((progress - start) / (end - start), 0), 1);
      const easedProgress = applyEasing(segmentProgress, easings[index] ?? LINEAR);

      return values[index] + (values[index + 1] - values[index]) * easedProgress;
    }
  }

  return values[values.length - 1];
};

const getScale = (progress: number, name: AnimatedTabIconName) => {
  'worklet';

  if (name === 'savings') {
    return interpolateKeyframes(
      progress,
      SAVINGS_SCALE_TIMES,
      SAVINGS_SCALE_VALUES,
      SAVINGS_SCALE_EASINGS,
    );
  }

  return interpolateKeyframes(
    progress,
    WALLET_SCALE_TIMES,
    WALLET_SCALE_VALUES,
    WALLET_SCALE_EASINGS,
  );
};

const getRotation = (progress: number, name: AnimatedTabIconName) => {
  'worklet';

  if (name !== 'savings') return 0;

  return interpolateKeyframes(
    progress,
    SAVINGS_ROTATE_TIMES,
    SAVINGS_ROTATE_VALUES,
    SAVINGS_ROTATE_EASINGS,
  );
};

const getFillOpacity = (progress: number, name: AnimatedTabIconName) => {
  'worklet';

  const fadeStart = name === 'savings' ? 0.2085 : 0.1835;
  const fadeEnd = name === 'savings' ? 0.3335 : 0.3165;

  if (progress <= fadeStart) return 0;
  if (progress >= fadeEnd) return 1;

  return easeOut((progress - fadeStart) / (fadeEnd - fadeStart));
};

const getOutlineColorProgress = (progress: number) => {
  'worklet';

  if (progress <= 0.1) return 0;
  if (progress >= 0.2) return 1;

  return easeOut((progress - 0.1) / 0.1);
};

type VectorFrameProps = {
  width: number;
  height: number;
  children: React.ReactNode;
};

function VectorFrame({ width, height, children }: VectorFrameProps) {
  return (
    <View
      style={[
        styles.vectorFrame,
        {
          left: (ICON_SIZE - width) / 2,
          top: (ICON_SIZE - height) / 2,
          width,
          height,
        },
      ]}
    >
      {children}
    </View>
  );
}

/**
 * Wallet, Savings, and Rewards icons from the Figma tab-icon motion set.
 * Every icon drives its layers from one 2-second progress value so the scale,
 * stroke, and fill tracks stay coordinated with the exported timeline.
 */
export function AnimatedTabIcon({ name, focused, size = 24 }: AnimatedTabIconProps) {
  const reduceMotion = useReducedMotion();
  const progress = useSharedValue(focused && reduceMotion ? 1 : 0);

  useEffect(() => {
    cancelAnimation(progress);

    if (!focused) {
      progress.value = 0;
      return;
    }

    if (reduceMotion) {
      progress.value = 1;
      return;
    }

    progress.value = 0;
    progress.value = withTiming(1, {
      duration: ANIMATION_DURATION_MS,
      easing: Easing.linear,
    });

    return () => cancelAnimation(progress);
  }, [focused, progress, reduceMotion]);

  const motionStyle = useAnimatedStyle(() => {
    const scale = getScale(progress.value, name);
    const rotation = getRotation(progress.value, name);

    return {
      transform: [{ rotate: `${rotation}deg` }, { scaleX: scale }, { scaleY: scale }],
    };
  });

  const fillStyle = useAnimatedStyle(() => ({
    opacity: getFillOpacity(progress.value, name),
  }));

  const outlineAnimatedProps = useAnimatedProps(() => ({
    stroke: interpolateColor(
      getOutlineColorProgress(progress.value),
      [0, 1],
      [OUTLINE_COLOR, ACTIVE_COLOR],
    ) as string,
  }));

  const renderOutline = () => {
    if (name === 'wallet') {
      return (
        <Svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24" fill="none">
          <AnimatedPath
            animatedProps={outlineAnimatedProps}
            d={WALLET_PATH}
            fill="none"
            stroke={OUTLINE_COLOR}
            strokeWidth={1.5}
          />
        </Svg>
      );
    }

    if (name === 'savings') {
      return (
        <VectorFrame width={17.3355} height={20.1171}>
          <Svg width="100%" height="100%" viewBox="0 0 17.3355 20.1171" fill="none">
            <AnimatedPath
              animatedProps={outlineAnimatedProps}
              d={SAVINGS_PATH}
              fill="none"
              stroke={OUTLINE_COLOR}
              strokeWidth={1.5}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>
        </VectorFrame>
      );
    }

    return (
      <VectorFrame width={18.5004} height={20.5}>
        <Svg width="100%" height="100%" viewBox="0 0 18.5004 20.5" fill="none">
          <AnimatedPath
            animatedProps={outlineAnimatedProps}
            d={REWARDS_OUTLINE_PATH}
            fill="none"
            stroke={OUTLINE_COLOR}
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      </VectorFrame>
    );
  };

  const renderFill = () => {
    if (name === 'wallet') {
      return (
        <Svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24" fill="none">
          <Path d={WALLET_PATH} fill={ACTIVE_COLOR} stroke={ACTIVE_COLOR} strokeWidth={1.5} />
        </Svg>
      );
    }

    if (name === 'savings') {
      return (
        <VectorFrame width={17.3355} height={20.1171}>
          <Svg width="100%" height="100%" viewBox="0 0 17.3355 20.1171" fill="none">
            <Path
              d={SAVINGS_PATH}
              fill={ACTIVE_COLOR}
              stroke={ACTIVE_COLOR}
              strokeWidth={1.5}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>
        </VectorFrame>
      );
    }

    return (
      <VectorFrame width={18.5004} height={20.5}>
        <Svg width="100%" height="100%" viewBox="0 0 18.5004 20.5" fill="none">
          <Path
            d={REWARDS_FILL_PATH}
            fill={ACTIVE_COLOR}
            stroke={ACTIVE_COLOR}
            strokeWidth={1.5}
            strokeLinejoin="round"
          />
        </Svg>
      </VectorFrame>
    );
  };

  return (
    <View style={[styles.slot, { width: size, height: size }]}>
      <Animated.View style={[styles.icon, motionStyle]}>
        {renderOutline()}
        <Animated.View style={[styles.fillLayer, fillStyle]}>{renderFill()}</Animated.View>
        {name === 'rewards' && (
          <Animated.View style={[styles.fillLayer, fillStyle]}>
            <VectorFrame width={18.5004} height={20.5}>
              <Svg width="100%" height="100%" viewBox="0 0 18.5004 20.5" fill="none">
                <Path
                  d={REWARDS_DETAIL_PATH}
                  fill="none"
                  stroke={REWARDS_DETAIL_COLOR}
                  strokeWidth={1.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </Svg>
            </VectorFrame>
          </Animated.View>
        )}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  slot: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    position: 'relative',
    width: ICON_SIZE,
    height: ICON_SIZE,
  },
  fillLayer: {
    ...StyleSheet.absoluteFillObject,
  },
  vectorFrame: {
    position: 'absolute',
  },
});
