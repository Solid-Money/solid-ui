import * as React from "react";
import { useEffect } from "react";
import Animated, {
  Easing,
  useAnimatedProps,
  useSharedValue,
  withTiming
} from "react-native-reanimated";
import Svg, { Circle, Path } from "react-native-svg";

const AnimatedSvg = Animated.createAnimatedComponent(Svg);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedPath = Animated.createAnimatedComponent(Path);

interface CheckmarkProps {
  width?: number;
  height?: number;
  onAnimationComplete?: () => void;
}

const Checkmark = ({
  width = 154,
  height = 154,
  onAnimationComplete
}: CheckmarkProps) => {
  const circleProgress = useSharedValue(0);
  const pathProgress = useSharedValue(0);

  const circleAnimatedProps = useAnimatedProps(() => {
    const radius = 74;
    const circumference = 2 * Math.PI * radius;
    const strokeDasharray = circumference;
    const strokeDashoffset = circumference * (1 - circleProgress.value);

    return {
      strokeDasharray,
      strokeDashoffset,
    };
  });

  const pathAnimatedProps = useAnimatedProps(() => {
    const pathLength = 100;
    const strokeDasharray = pathLength;
    const strokeDashoffset = - pathLength * (1 - pathProgress.value);

    return {
      strokeDasharray,
      strokeDashoffset,
    };
  });

  useEffect(() => {
    circleProgress.value = withTiming(1, {
      duration: 600,
      easing: Easing.out(Easing.cubic),
    }, () => {
      pathProgress.value = withTiming(1, {
        duration: 400,
        easing: Easing.bezier(0.25, 0.1, 0.25, 1),
      }, () => {
        onAnimationComplete?.();
      });
    });
  }, []);

  return (
    <AnimatedSvg
      width={width}
      height={height}
      viewBox="0 0 154 154"
      fill="none"
    >
      <AnimatedCircle
        cx={77}
        cy={76.6797}
        r={74}
        stroke="#838383"
        strokeWidth={5}
        fill="none"
        animatedProps={circleAnimatedProps}
      />
      <AnimatedPath
        d="M112.369 56.1797L69.9025 99.1797L54.3691 83.5433"
        stroke="#838383"
        strokeWidth={5}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
        animatedProps={pathAnimatedProps}
      />
    </AnimatedSvg>
  );
};

export default Checkmark;
