import { LinearGradient } from 'expo-linear-gradient';
import { Dimensions, StyleSheet } from 'react-native';
import Animated, { interpolate, SharedValue, useAnimatedStyle } from 'react-native-reanimated';

import { ONBOARDING_DATA } from '@/lib/types/onboarding';

const { width: screenWidth } = Dimensions.get('window');

// Gradient colors for each slide
const GRADIENT_COLORS: [string, string][] = [
  ['rgba(122, 84, 234, 0.30)', 'rgba(122, 84, 234, 0.09)'], // Purple - rocket
  ['rgba(148, 242, 127, 0.20)', 'rgba(148, 242, 127, 0.03)'], // Green - cards
  ['rgba(255, 209, 81, 0.30)', 'rgba(255, 209, 81, 0.09)'], // Yellow/Gold - vault
];

interface AnimatedGradientBackgroundProps {
  scrollX: SharedValue<number>;
  children: React.ReactNode;
}

const AnimatedLinearGradient = Animated.createAnimatedComponent(LinearGradient);

// Input range for scroll-based interpolation
const inputRange = ONBOARDING_DATA.map((_, i) => i * screenWidth);

// Custom hook to create gradient opacity style
function useGradientOpacity(scrollX: SharedValue<number>, targetIndex: number) {
  return useAnimatedStyle(() => {
    const outputRange = ONBOARDING_DATA.map((_, i) => (i === targetIndex ? 1 : 0));
    const opacity = interpolate(scrollX.value, inputRange, outputRange, 'clamp');
    return { opacity };
  });
}

export function AnimatedGradientBackground({ scrollX, children }: AnimatedGradientBackgroundProps) {
  // Call hooks at the top level - one for each gradient
  const gradientStyle0 = useGradientOpacity(scrollX, 0);
  const gradientStyle1 = useGradientOpacity(scrollX, 1);
  const gradientStyle2 = useGradientOpacity(scrollX, 2);
  const gradientStyles = [gradientStyle0, gradientStyle1, gradientStyle2];

  return (
    <>
      {/* Stack all gradients, animating their opacity */}
      {GRADIENT_COLORS.map((colors, index) => (
        <AnimatedLinearGradient
          key={index}
          colors={colors}
          start={{ x: 0.2, y: 0.2 }}
          end={{ x: 0.8, y: 0.8 }}
          style={[StyleSheet.absoluteFill, gradientStyles[index]]}
        />
      ))}
      {/* Render children on top of gradients */}
      {children}
    </>
  );
}
