import { interpolate, SharedValue, useAnimatedStyle } from 'react-native-reanimated';

interface GradientStyle {
  opacity: number;
}

const INPUT_RANGE = [0, 1, 2, 3];

function useGradientStyle(
  progress: SharedValue<number>,
  scale: SharedValue<number> | number,
  targetIndex: number,
) {
  return useAnimatedStyle(() => {
    'worklet';
    const s = typeof scale === 'number' ? scale : scale.value;
    const normalizedProgress = s === 0 ? 0 : progress.value / s;
    const outputRange = [0, 0, 0, 0];
    outputRange[targetIndex] = 1;
    const opacity = interpolate(normalizedProgress, INPUT_RANGE, outputRange, 'clamp');
    return { opacity };
  });
}

/**
 * Hook that creates animated opacity styles for n-slide gradient crossfade.
 * Works with both scroll-based (pixel values) and index-based (0 to n-1) progress values.
 *
 * @param progress - Shared value representing current position (either scrollX or index)
 * @param scale - Multiplier to normalize progress to 0 to n-1 range (use screenWidth for scroll, 1 for index)
 * @returns Array of n animated styles for gradient opacity
 */
export function useGradientStyles(
  progress: SharedValue<number>,
  scale: SharedValue<number> | number = 1,
): GradientStyle[] {
  const style0 = useGradientStyle(progress, scale, 0);
  const style1 = useGradientStyle(progress, scale, 1);
  const style2 = useGradientStyle(progress, scale, 2);
  const style3 = useGradientStyle(progress, scale, 3);

  return [style0, style1, style2, style3];
}
