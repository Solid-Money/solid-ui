import { interpolate, SharedValue, useAnimatedStyle } from 'react-native-reanimated';

/**
 * Hook that creates animated opacity styles for 3-slide gradient crossfade.
 * Works with both scroll-based (pixel values) and index-based (0-2) progress values.
 *
 * @param progress - Shared value representing current position (either scrollX or index)
 * @param scale - Multiplier to normalize progress to 0-2 range (use screenWidth for scroll, 1 for index)
 * @returns Array of 3 animated styles for gradient opacity
 */
export function useGradientStyles(
  progress: SharedValue<number>,
  scale: SharedValue<number> | number = 1,
): [{ opacity: number }, { opacity: number }, { opacity: number }] {
  const gradientStyle0 = useAnimatedStyle(() => {
    'worklet';
    const s = typeof scale === 'number' ? scale : scale.value;
    const normalizedProgress = s === 0 ? 0 : progress.value / s;
    const opacity = interpolate(normalizedProgress, [0, 1, 2], [1, 0, 0], 'clamp');
    return { opacity };
  });

  const gradientStyle1 = useAnimatedStyle(() => {
    'worklet';
    const s = typeof scale === 'number' ? scale : scale.value;
    const normalizedProgress = s === 0 ? 0 : progress.value / s;
    const opacity = interpolate(normalizedProgress, [0, 1, 2], [0, 1, 0], 'clamp');
    return { opacity };
  });

  const gradientStyle2 = useAnimatedStyle(() => {
    'worklet';
    const s = typeof scale === 'number' ? scale : scale.value;
    const normalizedProgress = s === 0 ? 0 : progress.value / s;
    const opacity = interpolate(normalizedProgress, [0, 1, 2], [0, 0, 1], 'clamp');
    return { opacity };
  });

  return [gradientStyle0, gradientStyle1, gradientStyle2];
}
