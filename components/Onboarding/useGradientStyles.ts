import { interpolate, SharedValue, useAnimatedStyle } from 'react-native-reanimated';

interface GradientStyle {
  opacity: number;
}

const INPUT_RANGE = [0, 1, 2, 3];

function useGradientStyle(
  progress: SharedValue<number>,
  scale: SharedValue<number>,
  targetIndex: number,
) {
  return useAnimatedStyle(() => {
    'worklet';
    const s = scale.value;
    const normalizedProgress = s === 0 ? 0 : progress.value / s;
    const outputRange = [0, 0, 0, 0];
    outputRange[targetIndex] = 1;
    const opacity = interpolate(normalizedProgress, INPUT_RANGE, outputRange, 'clamp');
    return { opacity };
  }, [targetIndex]);
}

/**
 * Hook that creates animated opacity styles for 4-slide gradient crossfade.
 * Normalizes scroll position to page index (0-3) and creates opacity styles.
 *
 * @param progress - SharedValue representing scroll position (scrollX)
 * @param scale - SharedValue for screen width to normalize progress to 0-3 range
 * @returns Array of 4 animated styles for gradient opacity
 */
export function useGradientStyles(
  progress: SharedValue<number>,
  scale: SharedValue<number>,
): GradientStyle[] {
  const style0 = useGradientStyle(progress, scale, 0);
  const style1 = useGradientStyle(progress, scale, 1);
  const style2 = useGradientStyle(progress, scale, 2);
  const style3 = useGradientStyle(progress, scale, 3);

  return [style0, style1, style2, style3];
}
