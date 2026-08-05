import { useCallback, useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, View } from 'react-native';

import ButtonOn from '@/assets/images/spin-win/button-on';
import Outline from '@/assets/images/spin-win/outline';
import TopTriangle from '@/assets/images/spin-win/top-triangle';
import RotatingWheelImage, { type RotatingWheelImageHandle } from '@/components/RotatingWheelImage';

const WHEEL_IMAGE = require('@/assets/images/spin-win/stop-wheel.png');
const RANDOM_LANDING_ANGLES = [45, 90, 135, 180, 225, 270, 315, 0];
const POINT_LANDING_ANGLES: Record<number, number> = {
  1000: 45,
  10000: 90,
  2000: 135,
  75: 180,
  500: 225,
  1500: 270,
  750: 315,
  100: 0,
};
const WHEEL_FRAME_SIZE = 700;
const WHEEL_IMAGE_SIZE = 800;
// The path only occupies ~90% of its 304-unit viewBox. Render it wider so the
// visible edges align with the wheel's 45-degree segment at the colored rim.
const OUTLINE_WIDTH = 306;
const TRIANGLE_WIDTH = 112;
const WHEEL_IMAGE_OFFSET = (WHEEL_FRAME_SIZE - WHEEL_IMAGE_SIZE) / 2;
const OUTLINE_LEFT = (WHEEL_FRAME_SIZE - OUTLINE_WIDTH) / 2;
const TRIANGLE_LEFT = (WHEEL_FRAME_SIZE - TRIANGLE_WIDTH) / 2;

export type PrizeWheelProps = {
  onSpin?: () => Promise<number | undefined>;
  onSpinEnd?: (points: number) => void;
  onSpinError?: (error: unknown) => void;
  disabled?: boolean;
};

export default function PrizeWheel({
  onSpin,
  onSpinEnd,
  onSpinError,
  disabled = false,
}: PrizeWheelProps) {
  const wheelRef = useRef<RotatingWheelImageHandle>(null);
  const isSpinningRef = useRef(false);
  const pendingPointsRef = useRef<number | undefined>(undefined);

  const outlineOpacity = useRef(new Animated.Value(0)).current;
  const outlineTranslateY = useRef(new Animated.Value(-430)).current;

  const triangleTranslateY = useRef(new Animated.Value(-18)).current;
  const triangleOpacity = useRef(new Animated.Value(0)).current;
  const selectorAnimationRef = useRef<Animated.CompositeAnimation | null>(null);

  const glowPulse = useRef(new Animated.Value(-1)).current;
  const glowPulseAnimationRef = useRef<Animated.CompositeAnimation | null>(null);

  const startSpin = useCallback(async () => {
    if (disabled || isSpinningRef.current) return;

    isSpinningRef.current = true;
    glowPulseAnimationRef.current?.stop();
    glowPulse.setValue(0);

    const glowPulseAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(glowPulse, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.timing(glowPulse, {
          toValue: 0,
          duration: 600,
          useNativeDriver: true,
        }),
      ]),
    );

    glowPulseAnimationRef.current = glowPulseAnimation;
    glowPulseAnimation.start();

    selectorAnimationRef.current?.stop();
    outlineTranslateY.setValue(-430);
    triangleOpacity.setValue(0);

    const selectorAnimation = Animated.sequence([
      // Outline enters first
      Animated.parallel([
        Animated.timing(outlineTranslateY, {
          toValue: 0,
          duration: 350,
          easing: Easing.bezier(0.22, 1, 0.36, 1),
          useNativeDriver: true,
        }),
        Animated.timing(outlineOpacity, {
          toValue: 1,
          duration: 300,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),

      Animated.delay(50),

      // Triangle enters after the outline is nearly settled
      Animated.parallel([
        Animated.timing(triangleTranslateY, {
          toValue: 0,
          duration: 350,
          easing: Easing.bezier(0.22, 1, 0.36, 1),
          useNativeDriver: true,
        }),
        Animated.timing(triangleOpacity, {
          toValue: 1,
          duration: 300,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),
    ]);

    selectorAnimationRef.current = selectorAnimation;
    selectorAnimation.start(({ finished }) => {
      if (finished) selectorAnimationRef.current = null;
    });

    const randomAngle =
      RANDOM_LANDING_ANGLES[Math.floor(Math.random() * RANDOM_LANDING_ANGLES.length)];

    wheelRef.current?.startCruise();

    try {
      const points = await onSpin?.();
      const landingAngle =
        points == null ? randomAngle : (POINT_LANDING_ANGLES[points] ?? randomAngle);

      pendingPointsRef.current = points;
      wheelRef.current?.land(landingAngle);
    } catch (error) {
      wheelRef.current?.stop();
      glowPulseAnimationRef.current?.stop();
      glowPulseAnimationRef.current = null;
      glowPulse.setValue(-1);
      isSpinningRef.current = false;
      onSpinError?.(error);
    }
  }, [disabled, glowPulse, onSpin, onSpinError, outlineTranslateY, triangleOpacity]);

  useEffect(() => {
    return () => {
      selectorAnimationRef.current?.stop();
      glowPulseAnimationRef.current?.stop();
      wheelRef.current?.stop();
    };
  }, []);

  return (
    <View
      style={{
        width: '100%',
        maxWidth: 419,
        aspectRatio: 419 / 810,
        overflow: 'hidden',
      }}
    >
      <View
        style={{
          position: 'absolute',
          top: 120,
          left: '50%',
          width: WHEEL_FRAME_SIZE,
          height: WHEEL_FRAME_SIZE,
          transform: [{ translateX: -WHEEL_FRAME_SIZE / 2 }],
        }}
      >
        <Animated.View
          style={{
            position: 'absolute',
            top: WHEEL_IMAGE_OFFSET,
            left: WHEEL_IMAGE_OFFSET,
            width: WHEEL_IMAGE_SIZE,
            height: WHEEL_IMAGE_SIZE,
          }}
        >
          <RotatingWheelImage
            ref={wheelRef}
            source={WHEEL_IMAGE}
            size={WHEEL_IMAGE_SIZE}
            duration={6734}
            turns={6}
            onSpinEnd={() => {
              isSpinningRef.current = false;
              glowPulseAnimationRef.current?.stop();
              glowPulseAnimationRef.current = null;
              glowPulse.setValue(-1);
              onSpinEnd?.(pendingPointsRef.current ?? 0);
              pendingPointsRef.current = undefined;
            }}
          />
        </Animated.View>

        <Animated.View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: -48,
            left: OUTLINE_LEFT,
            zIndex: 2,
            transform: [{ translateY: outlineTranslateY }],
            opacity: outlineOpacity,
          }}
        >
          <Outline />
        </Animated.View>

        <Animated.View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: -20,
            left: TRIANGLE_LEFT,
            zIndex: 3,
            opacity: triangleOpacity,
            transform: [{ translateY: triangleTranslateY }],
          }}
        >
          <TopTriangle />
        </Animated.View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Spin the wheel"
          disabled={disabled}
          onPress={startSpin}
          style={{
            position: 'absolute',
            left: '29%',
            top: '33%',
            overflow: 'hidden',
            opacity: disabled ? 0.55 : 1,
            elevation: 10,
            zIndex: 4,
          }}
        >
          <ButtonOn />
        </Pressable>
      </View>
    </View>
  );
}
