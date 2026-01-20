import * as React from 'react';
import { Platform, StyleProp, View, ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { cn } from '@/lib/utils';

const duration = 1000;

interface SkeletonProps extends Omit<
  React.ComponentPropsWithoutRef<typeof Animated.View>,
  'style'
> {
  style?: StyleProp<ViewStyle>;
}

export default function Skeleton({ className, style: customStyle, ...props }: SkeletonProps) {
  const sv = useSharedValue(1);

  React.useEffect(() => {
    sv.value = withRepeat(
      withSequence(withTiming(0.5, { duration }), withTiming(1, { duration })),
      -1,
    );
  }, [sv]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: sv.value,
  }));

  // Check if custom backgroundColor is provided - skip default bg classes if so
  const hasCustomBg =
    customStyle && typeof customStyle === 'object' && 'backgroundColor' in customStyle;

  if (Platform.OS === 'web') {
    return (
      <View
        className={cn('rounded-md', !hasCustomBg && 'bg-secondary dark:bg-muted', className)}
        style={customStyle}
      />
    );
  }

  return (
    <Animated.View
      style={[animatedStyle, customStyle]}
      className={cn('rounded-md', !hasCustomBg && 'bg-secondary dark:bg-muted', className)}
      {...props}
    />
  );
}
