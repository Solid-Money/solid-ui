import { BottomTabBarButtonProps } from '@react-navigation/bottom-tabs';
import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

export function HapticTab({
  style,
  children,
  onPress,
  onLongPress,
  accessibilityLabel,
  accessibilityRole,
  accessibilityState,
  testID,
}: BottomTabBarButtonProps) {
  const [pressed, setPressed] = useState(false);

  const handlePressIn = () => {
    setPressed(true);
    if (Platform.OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const handlePressOut = () => {
    setPressed(false);
  };

  // Animation styles based on pressed state
  const animationStyle =
    Platform.OS === 'web'
      ? {
          transition:
            'transform 150ms cubic-bezier(0.4, 0, 0.2, 1), opacity 150ms cubic-bezier(0.4, 0, 0.2, 1)',
          transform: pressed ? 'scale(0.9)' : 'scale(1)',
          opacity: pressed ? 0.5 : 1,
        }
      : {
          opacity: pressed ? 0.5 : 1,
          transform: [{ scale: pressed ? 0.85 : 1 }],
        };

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole={accessibilityRole}
      accessibilityState={accessibilityState}
      testID={testID}
      style={[styles.pressable, style]}
    >
      {/* @ts-ignore - web CSS properties */}
      <View style={[styles.content, animationStyle]}>{children}</View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressable: {
    flex: 1,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
