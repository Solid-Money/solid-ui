import { useEffect, useMemo } from 'react';
import { StyleSheet, useWindowDimensions } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

const CONFETTI_COLORS = ['#FFD151', '#FFFFFF', '#FFD151', '#FFFFFF', '#E8956A'];
const PARTICLE_COUNT = 45;

interface ConfettiOverlayProps {
  visible: boolean;
}

function Particle({
  index,
  screenWidth,
  screenHeight,
}: {
  index: number;
  screenWidth: number;
  screenHeight: number;
}) {
  const translateY = useSharedValue(-20);
  const translateX = useSharedValue(Math.random() * screenWidth);
  const rotate = useSharedValue(0);
  const opacity = useSharedValue(1);

  // Generate varied particle dimensions once
  const dimensions = useMemo(() => {
    const baseSize = 8 + Math.random() * 10;
    // Vary aspect ratio: some particles are more square, some more rectangular
    const aspectRatio = 1.2 + Math.random() * 0.8;
    return {
      width: baseSize,
      height: baseSize * aspectRatio,
      borderRadius: 2 + Math.random() * 2,
    };
  }, []);

  useEffect(() => {
    const delay = index * 60;
    translateY.value = withDelay(
      delay,
      withTiming(screenHeight + 20, {
        duration: 2500 + Math.random() * 1000,
        easing: Easing.out(Easing.quad),
      }),
    );
    rotate.value = withDelay(delay, withTiming(360 * (2 + Math.random() * 3), { duration: 3000 }));
    opacity.value = withDelay(delay + 1800, withTiming(0, { duration: 700 }));
  }, [index, screenHeight, translateY, rotate, opacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { rotate: `${rotate.value}deg` },
    ],
    opacity: opacity.value,
  }));

  const color = CONFETTI_COLORS[index % CONFETTI_COLORS.length];

  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          width: dimensions.width,
          height: dimensions.height,
          backgroundColor: color,
          borderRadius: dimensions.borderRadius,
        },
        animatedStyle,
      ]}
    />
  );
}

export default function ConfettiOverlay({ visible }: ConfettiOverlayProps) {
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();

  if (!visible) return null;

  return (
    <Animated.View style={[StyleSheet.absoluteFill, { pointerEvents: 'none', zIndex: 100 }]}>
      {Array.from({ length: PARTICLE_COUNT }).map((_, i) => (
        <Particle key={i} index={i} screenWidth={screenWidth} screenHeight={screenHeight} />
      ))}
    </Animated.View>
  );
}
