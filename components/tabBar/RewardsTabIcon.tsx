import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import Svg, { G, Path } from 'react-native-svg';

interface RewardsTabIconProps {
  focused: boolean;
  /** The tab-bar icon slot size (matches the other tab icons). */
  size: number;
}

const LOOP_DURATION_MS = 730;
const EASE_OUT = Easing.bezier(0, 0, 0.58, 1).factory();

const mix = (from: number, to: number, progress: number) => {
  'worklet';
  return from + (to - from) * progress;
};

const segmentProgress = (progress: number, start: number, end: number) => {
  'worklet';
  return Math.min(Math.max((progress - start) / (end - start), 0), 1);
};

const getScale = (progress: number) => {
  'worklet';

  if (progress <= 0.2055) return 1;

  if (progress <= 0.3288) {
    return mix(1, 0.88, EASE_OUT(segmentProgress(progress, 0.2055, 0.3288)));
  }

  if (progress <= 0.6164) {
    return mix(0.88, 1.12, EASE_OUT(segmentProgress(progress, 0.3288, 0.6164)));
  }

  const settleProgress = segmentProgress(progress, 0.6164, 1);
  const settleEasing =
    1 -
    Math.exp(-settleProgress * 7.6195) *
      (Math.cos(settleProgress * 7.3441) + 1.0375 * Math.sin(settleProgress * 7.3441));

  return mix(1.12, 1, settleEasing);
};

const getOutlineOpacity = (progress: number) => {
  'worklet';

  if (progress <= 0.2055) return 1;
  if (progress >= 0.4521) return 0;

  return mix(1, 0, EASE_OUT(segmentProgress(progress, 0.2055, 0.4521)));
};

const getFilledOpacity = (progress: number) => {
  'worklet';

  if (progress <= 0.2329) return 0;
  if (progress >= 0.5068) return 1;

  return EASE_OUT(segmentProgress(progress, 0.2329, 0.5068));
};

const OutlineCube = () => (
  <Svg width="100%" height="100%" viewBox="0 0 24 24" fill="none">
    <G transform="translate(1 1)">
      <Path
        d="M14.5777 2.38197L16.5777 3.43152C18.7294 4.56066 19.8052 5.12523 20.4026 6.13974C21 7.15425 21 8.41667 21 10.9415V11.0585C21 13.5833 21 14.8458 20.4026 15.8603C19.8052 16.8748 18.7294 17.4393 16.5777 18.5685L14.5777 19.618C12.8221 20.5393 11.9443 21 11 21C10.0557 21 9.1779 20.5393 7.42229 19.618L5.42229 18.5685C3.27063 17.4393 2.19479 16.8748 1.5974 15.8603C1 14.8458 1 13.5833 1 11.0585V10.9415C1 8.41667 1 7.15425 1.5974 6.13974C2.19479 5.12523 3.27063 4.56066 5.42229 3.43152L7.42229 2.38197C9.1779 1.46066 10.0557 1 11 1C11.9443 1 12.8221 1.46066 14.5777 2.38197Z"
        stroke="white"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <Path
        d="M20 6.5L16 8.5M16 8.5C16 8.5 15.6953 8.65237 15.5 8.75C13.7426 9.6287 11 11 11 11M16 8.5V12M16 8.5L6.5 3.5M11 11L2 6.5M11 11V20.5"
        stroke="white"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </G>
  </Svg>
);

const FilledCube = () => (
  <Svg width="100%" height="100%" viewBox="0 0 24 24" fill="none">
    <G transform="translate(1 1)">
      <Path
        d="M15 12V10.1182L12 11.6182V19.7686C12.0146 19.7628 12.0296 19.7575 12.0448 19.7521C12.0639 19.7453 12.0833 19.7384 12.1025 19.7305C12.6076 19.5216 13.2196 19.2014 14.1133 18.7324L16.1133 17.6826C17.2074 17.1084 17.9592 16.7127 18.5176 16.3398C19.055 15.9809 19.3443 15.6866 19.541 15.3525C19.7393 15.0157 19.863 14.6044 19.9297 13.9277C19.9984 13.23 20 12.3405 20 11.0586V10.9414C20 9.65947 19.9984 8.76999 19.9297 8.07227C19.9111 7.8837 19.8872 7.71594 19.8594 7.56445L17 9.09766V12C17 12.5523 16.5523 13 16 13C15.4477 13 15 12.5523 15 12Z"
        fill="white"
      />
      <Path
        d="M2 11.0586C2 12.3405 2.00158 13.23 2.07032 13.9277C2.13698 14.6044 2.26072 15.0157 2.45899 15.3525C2.65567 15.6866 2.94495 15.9809 3.48242 16.3398C4.04085 16.7128 4.79265 17.1084 5.88672 17.6826L7.88672 18.7324C8.78037 19.2014 9.39242 19.5216 9.89746 19.7305C9.91673 19.7384 9.9361 19.7453 9.95518 19.7521C9.97037 19.7575 9.98538 19.7628 10 19.7686V11.6084L2.14258 7.54688C2.11326 7.70286 2.0896 7.87648 2.07032 8.07227C2.00158 8.77 2 9.65947 2 10.9414V11.0586Z"
        fill="white"
      />
      <Path
        d="M5.88672 4.31738C4.79265 4.89153 4.04085 5.28724 3.48242 5.66016C3.38531 5.72501 1.30086 4.87951 3.21485 5.84961L11.0068 9.87793L13.8086 8.47656L6.03418 4.38477C5.98939 4.36118 5.94783 4.33375 5.90821 4.30469L5.88672 4.31738Z"
        fill="white"
      />
      <Path
        d="M11 2C10.7046 2 10.3841 2.06828 9.89746 2.26953C9.42312 2.46571 8.85462 2.76002 8.04688 3.18359L15.9951 7.36719L18.8018 5.8623C18.7154 5.7971 18.6213 5.72945 18.5176 5.66016C17.9592 5.28725 17.2074 4.89152 16.1133 4.31738L14.1133 3.26758C13.2196 2.79861 12.6076 2.4784 12.1025 2.26953C11.6159 2.06828 11.2954 2 11 2Z"
        fill="white"
      />
      <Path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M12 19.7686L11 22L10 19.7686C9.98538 19.7628 9.97037 19.7575 9.95518 19.7521C9.9361 19.7453 9.91673 19.7384 9.89746 19.7305C9.39242 19.5216 8.78037 19.2014 7.88672 18.7324L5.88672 17.6826C4.79265 17.1084 4.04085 16.7128 3.48242 16.3398C2.94495 15.9809 2.65567 15.6866 2.45899 15.3525C2.26072 15.0157 2.13698 14.6044 2.07032 13.9277C2.00158 13.23 2 12.3405 2 11.0586V10.9414C2 9.65947 2.00158 8.77 2.07032 8.07227C2.0896 7.87648 2.11326 7.70286 2.14258 7.54688L0.500001 5.63184L3.21485 5.84961C1.30086 4.87951 3.38531 5.72501 3.48242 5.66016C4.04085 5.28724 4.79265 4.89153 5.88672 4.31738L5.90821 4.30469L8.04688 3.18359C8.85462 2.76002 9.42312 2.46571 9.89746 2.26953C10.3841 2.06828 10.7046 2 11 2C11.2954 2 11.6159 2.06828 12.1025 2.26953C12.6076 2.4784 13.2196 2.79861 14.1133 3.26758L16.1133 4.31738C17.2074 4.89152 17.9592 5.28725 18.5176 5.66016C18.6213 5.72945 18.7154 5.7971 18.8018 5.8623L21.2647 5.63184L19.8594 7.56445C19.8872 7.71594 19.9111 7.8837 19.9297 8.07227C19.9984 8.76999 20 9.65947 20 10.9414V11.0586C20 12.3405 19.9984 13.23 19.9297 13.9277C19.863 14.6044 19.7393 15.0157 19.541 15.3525C19.3443 15.6866 19.055 15.9809 18.5176 16.3398C17.9592 16.7127 17.2074 17.1084 16.1133 17.6826L14.1133 18.7324C13.2196 19.2014 12.6076 19.5216 12.1025 19.7305C12.0833 19.7384 12.0639 19.7453 12.0448 19.7521C12.0296 19.7575 12.0146 19.7628 12 19.7686ZM22 11.0586V11.1259C22 12.3377 22.0001 13.3205 21.9209 14.124C21.8382 14.9631 21.6637 15.6906 21.2647 16.3682C20.864 17.0485 20.3156 17.5437 19.6279 18.0029C18.9696 18.4425 18.1207 18.888 17.0814 19.4334L17.042 19.4541L15.042 20.5039L15.0209 20.515C14.169 20.962 13.4708 21.3284 12.8672 21.5781C12.2399 21.8375 11.649 22 11 22C10.3511 22 9.76006 21.8375 9.13282 21.5781C8.52928 21.3285 7.83118 20.9621 6.97945 20.5152L6.95801 20.5039L4.95801 19.4541L4.91807 19.4331C3.87909 18.8879 3.0303 18.4425 2.37207 18.0029C1.68443 17.5437 1.13605 17.0486 0.735354 16.3682C0.336355 15.6906 0.16178 14.9631 0.0791045 14.124C-4.66138e-05 13.3205 -2.48814e-05 12.3377 9.28394e-07 11.1259L2.90049e-06 11.0586V10.9414L9.28394e-07 10.8741C-2.48878e-05 9.66229 -4.66212e-05 8.67944 0.0791045 7.87598C0.161781 7.03689 0.336362 6.30941 0.735354 5.63184C1.13602 4.95169 1.68457 4.45619 2.37207 3.99707C3.03058 3.55734 3.87978 3.11172 4.91935 2.56619L4.95801 2.5459L6.95801 1.49609L6.97924 1.48495C7.83107 1.03792 8.52923 0.671541 9.13282 0.421875C9.76007 0.162468 10.3511 0 11 0C11.6489 0 12.2399 0.162467 12.8672 0.421875C13.4708 0.671555 14.169 1.03796 15.0209 1.48503L15.042 1.49609L17.042 2.5459L17.0801 2.56591C18.12 3.11157 18.9693 3.55726 19.6279 3.99707C20.3156 4.4563 20.864 4.95148 21.2647 5.63184C21.6636 6.30941 21.8382 7.03689 21.9209 7.87598C22.0001 8.67944 22 9.6623 22 10.8741V10.9414V11.0586Z"
        fill="white"
      />
    </G>
  </Svg>
);

/**
 * Rewards cube from Figma. It rests as an outline while inactive, then
 * crossfades to the filled cube through the designed squash-and-settle loop.
 */
const RewardsTabIcon = ({ focused, size }: RewardsTabIconProps) => {
  const reduceMotion = useReducedMotion();
  const progress = useSharedValue(focused && reduceMotion ? 1 : 0);
  const iconSize = Math.min(size, 24);

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
      duration: LOOP_DURATION_MS,
      easing: Easing.linear,
    });

    return () => cancelAnimation(progress);
  }, [focused, progress, reduceMotion]);

  const scaleStyle = useAnimatedStyle(() => ({
    transform: [{ scale: getScale(progress.value) }],
  }));

  const outlineStyle = useAnimatedStyle(() => ({
    opacity: getOutlineOpacity(progress.value),
  }));

  const filledStyle = useAnimatedStyle(() => ({
    opacity: getFilledOpacity(progress.value),
  }));

  return (
    <View style={[styles.slot, { width: size, height: size }]}>
      <Animated.View style={[styles.icon, { width: iconSize, height: iconSize }, scaleStyle]}>
        <Animated.View style={[styles.layer, outlineStyle]}>
          <OutlineCube />
        </Animated.View>
        <Animated.View style={[styles.layer, filledStyle]}>
          <FilledCube />
        </Animated.View>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  slot: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    position: 'relative',
  },
  layer: {
    ...StyleSheet.absoluteFillObject,
  },
});

export default RewardsTabIcon;
