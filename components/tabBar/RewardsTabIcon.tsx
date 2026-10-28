import { useCallback } from 'react';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { useRewardsTabPop } from '@/hooks/useRewardsTabPop';

import { AnimatedTabIcon } from './AnimatedTabIcon';

/** CSS `ease-out`, the curve the Figma motion names (AnimatedTabIcon uses the same). */
const EASE_OUT = Easing.bezier(0, 0, 0.58, 1);

/** Figma motion, section 29541:13149: 1 → 0.88 → 1.12 → 1. */
const POP_SQUASH = { scale: 0.88, duration: 90 };
const POP_GROW = { scale: 1.12, duration: 210 };
/**
 * The settle back to 1, a spring of about 280ms. Reanimated takes a spring's
 * perceptual duration and runs 1.5× that, so 280 / 1.5. Slightly underdamped,
 * so it lands with a little give rather than stopping dead.
 */
const POP_SETTLE = { duration: Math.round(280 / 1.5), dampingRatio: 0.6 };

interface RewardsTabIconProps {
  focused: boolean;
  /** The navigation icon slot, passed through to the icon. */
  size?: number;
}

/**
 * The Rewards tab's icon, which pops once when a reward has been credited since
 * the user last saw one (see `useRewardsTabPop`). The pop scales the whole icon
 * around its own focus animation, and is skipped entirely with reduced motion.
 */
export function RewardsTabIcon({ focused, size }: RewardsTabIconProps) {
  const reduceMotion = useReducedMotion();
  const scale = useSharedValue(1);

  const pop = useCallback(() => {
    if (reduceMotion) return;
    cancelAnimation(scale);
    scale.value = withSequence(
      withTiming(POP_SQUASH.scale, { duration: POP_SQUASH.duration, easing: EASE_OUT }),
      withTiming(POP_GROW.scale, { duration: POP_GROW.duration, easing: EASE_OUT }),
      withSpring(1, POP_SETTLE),
    );
  }, [reduceMotion, scale]);

  useRewardsTabPop(focused, pop);

  const popStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Animated.View style={popStyle}>
      <AnimatedTabIcon name="rewards" focused={focused} size={size} />
    </Animated.View>
  );
}
