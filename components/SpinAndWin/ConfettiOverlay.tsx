import { useEffect, useMemo } from 'react';
import { StyleSheet, useWindowDimensions } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

const CONFETTI_COLORS = ['#FFD151', '#FFFFFF', '#FFD151', '#FFFFFF', '#E8956A'];
const PARTICLE_COUNT = 45;

/** A point in the overlay's own coordinates. */
interface BurstOrigin {
  x: number;
  y: number;
}

interface ConfettiOverlayProps {
  visible: boolean;
  /** Piece colours, cycled. Spin & Win's gold and white by default. */
  colors?: string[];
  /** How many pieces. */
  count?: number;
  /**
   * Bursts the pieces out from this point, once, instead of raining them from the top of the
   * screen. They spread, drift down and fade out within the overlay.
   */
  burstFrom?: BurstOrigin;
  /** Wait before the first piece moves, in ms. Burst only. */
  delay?: number;
}

function Particle({
  index,
  screenWidth,
  screenHeight,
  color,
}: {
  index: number;
  screenWidth: number;
  screenHeight: number;
  color: string;
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

/** Spread, then fall: one piece of a {@link ConfettiOverlay} burst. */
function BurstParticle({
  index,
  origin,
  delay,
  color,
}: {
  index: number;
  origin: BurstOrigin;
  delay: number;
  color: string;
}) {
  const translateX = useSharedValue(origin.x);
  const translateY = useSharedValue(origin.y);
  const rotate = useSharedValue(0);
  const scale = useSharedValue(0.4);
  const opacity = useSharedValue(0);

  const piece = useMemo(() => {
    const size = 7 + Math.random() * 10;
    // Every third piece is a dot, the rest are slips, as the burst is drawn.
    const isDot = index % 3 === 0;
    // Mostly upward and outward, so the pieces clear the card before they fall.
    const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.7;
    const distance = 80 + Math.random() * 110;
    return {
      width: size,
      height: isDot ? size : size * (0.7 + Math.random() * 0.7),
      borderRadius: isDot ? size / 2 : 2,
      dx: Math.cos(angle) * distance,
      dy: Math.sin(angle) * distance,
      fall: 120 + Math.random() * 80,
      spin: 360 * (1 + Math.random() * 2) * (Math.random() < 0.5 ? -1 : 1),
      stagger: Math.random() * 120,
    };
  }, [index]);

  useEffect(() => {
    const start = delay + piece.stagger;
    const spread = { duration: 700, easing: Easing.out(Easing.cubic) };
    const fall = { duration: 2200, easing: Easing.in(Easing.quad) };

    opacity.value = withDelay(
      start,
      withSequence(
        withTiming(1, { duration: 80 }),
        withDelay(2100, withTiming(0, { duration: 800 })),
      ),
    );
    scale.value = withDelay(start, withTiming(1, spread));
    translateX.value = withDelay(
      start,
      withSequence(
        withTiming(origin.x + piece.dx, spread),
        withTiming(origin.x + piece.dx * 1.15, fall),
      ),
    );
    translateY.value = withDelay(
      start,
      withSequence(
        withTiming(origin.y + piece.dy, spread),
        withTiming(origin.y + piece.dy + piece.fall, fall),
      ),
    );
    rotate.value = withDelay(start, withTiming(piece.spin, { duration: 2900 }));
  }, [delay, origin.x, origin.y, piece, translateX, translateY, rotate, scale, opacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      // Centred on its position, so the burst leaves from the origin itself.
      { translateX: translateX.value - piece.width / 2 },
      { translateY: translateY.value - piece.height / 2 },
      { rotate: `${rotate.value}deg` },
      { scale: scale.value },
    ],
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          width: piece.width,
          height: piece.height,
          backgroundColor: color,
          borderRadius: piece.borderRadius,
        },
        animatedStyle,
      ]}
    />
  );
}

export default function ConfettiOverlay({
  visible,
  colors = CONFETTI_COLORS,
  count = PARTICLE_COUNT,
  burstFrom,
  delay = 0,
}: ConfettiOverlayProps) {
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();

  if (!visible) return null;

  return (
    <Animated.View style={[StyleSheet.absoluteFill, { pointerEvents: 'none', zIndex: 100 }]}>
      {Array.from({ length: count }).map((_, i) =>
        burstFrom ? (
          <BurstParticle
            key={i}
            index={i}
            origin={burstFrom}
            delay={delay}
            color={colors[i % colors.length]}
          />
        ) : (
          <Particle
            key={i}
            index={i}
            screenWidth={screenWidth}
            screenHeight={screenHeight}
            color={colors[i % colors.length]}
          />
        ),
      )}
    </Animated.View>
  );
}
