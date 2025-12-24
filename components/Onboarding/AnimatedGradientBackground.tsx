import { LinearGradient } from 'expo-linear-gradient';
import { useEffect } from 'react';
import { StyleSheet, useWindowDimensions } from 'react-native';
import Animated, {
  interpolate,
  SharedValue,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';

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

export function AnimatedGradientBackground({ scrollX, children }: AnimatedGradientBackgroundProps) {
  const { width } = useWindowDimensions();

  // Use shared value for width so it's properly accessible in worklets
  const widthSV = useSharedValue(width);

  // Update shared value when dimensions change
  useEffect(() => {
    widthSV.value = width;
  }, [width, widthSV]);

  // Create animated styles - wrap LinearGradient in Animated.View for reliable animation
  const gradientStyle0 = useAnimatedStyle(() => {
    'worklet';
    const w = widthSV.value;
    const opacity = interpolate(scrollX.value, [0, w, w * 2], [1, 0, 0], 'clamp');
    return { opacity };
  });

  const gradientStyle1 = useAnimatedStyle(() => {
    'worklet';
    const w = widthSV.value;
    const opacity = interpolate(scrollX.value, [0, w, w * 2], [0, 1, 0], 'clamp');
    return { opacity };
  });

  const gradientStyle2 = useAnimatedStyle(() => {
    'worklet';
    const w = widthSV.value;
    const opacity = interpolate(scrollX.value, [0, w, w * 2], [0, 0, 1], 'clamp');
    return { opacity };
  });

  const gradientStyles = [gradientStyle0, gradientStyle1, gradientStyle2];

  return (
    <>
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
    </>
  );
}
