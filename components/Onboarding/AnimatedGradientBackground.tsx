import { useEffect } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { SharedValue, useSharedValue } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';

import { GRADIENT_COLORS } from '@/lib/types/onboarding';

import { useGradientStyles } from './useGradientStyles';

interface AnimatedGradientBackgroundProps {
  scrollX: SharedValue<number>;
  children: React.ReactNode;
}

export function AnimatedGradientBackground({ scrollX, children }: AnimatedGradientBackgroundProps) {
  const { width } = useWindowDimensions();

  // Use shared value for width so it's properly accessible in worklets
  const widthSV = useSharedValue(width);

  // Update shared value when dimensions change
  useEffect(() => {
    widthSV.value = width;
  }, [width, widthSV]);

  const gradientStyles = useGradientStyles(scrollX, widthSV);

  return (
    <View style={{ flex: 1 }}>
      {/* Stack all gradients, animating opacity on wrapper View */}
      {GRADIENT_COLORS.map((colors, index) => (
        <Animated.View key={index} style={[StyleSheet.absoluteFill, gradientStyles[index]]}>
          <LinearGradient
            colors={colors}
            start={{ x: 0.2, y: 0.2 }}
            end={{ x: 0.8, y: 0.8 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
      ))}
      {/* Render children on top of gradients */}
      {children}
    </View>
  );
}
