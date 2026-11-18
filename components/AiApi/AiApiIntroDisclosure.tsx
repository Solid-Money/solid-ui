import { type PropsWithChildren, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

export default function AiApiIntroDisclosure({
  expanded,
  children,
}: PropsWithChildren<{ expanded: boolean }>) {
  const [initiallyExpanded] = useState(expanded);
  const contentHeight = useSharedValue<number | null>(null);
  const progress = useSharedValue(expanded ? 1 : 0);

  useEffect(() => {
    progress.value = withTiming(expanded ? 1 : 0, {
      duration: 200,
      easing: Easing.bezier(0, 0, 0.2, 1),
    });
  }, [expanded, progress]);

  const animatedStyle = useAnimatedStyle(() => {
    const height = contentHeight.value;
    return { height: height === null ? (initiallyExpanded ? 'auto' : 0) : height * progress.value };
  });

  return (
    <Animated.View
      style={[styles.clip, animatedStyle]}
      pointerEvents={expanded ? 'auto' : 'none'}
      accessibilityElementsHidden={!expanded}
      importantForAccessibility={expanded ? 'auto' : 'no-hide-descendants'}
    >
      <View
        style={styles.content}
        onLayout={event => {
          contentHeight.value = event.nativeEvent.layout.height;
        }}
      >
        {children}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  // A native View clips with scroll overflow and lets Yoga measure the full content height.
  clip: { overflow: 'scroll' },
  content: { flexShrink: 0 },
});
