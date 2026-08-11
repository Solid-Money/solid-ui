import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, View } from 'react-native';
import LottieView from 'lottie-react-native';

import ButtonOn from '@/assets/images/spin-win/button-on';
import LeftFlash from '@/assets/images/spin-win/left-flash';
import Outline from '@/assets/images/spin-win/outline';
import OutlineFill, { type OutlineFillVariant } from '@/assets/images/spin-win/outline-fill';
import RightFlash from '@/assets/images/spin-win/right-flash';
import TopTriangle from '@/assets/images/spin-win/top-triangle';
import RotatingWheelImage, { type RotatingWheelImageHandle } from '@/components/RotatingWheelImage';

const WHEEL_IMAGE = require('@/assets/images/spin-win/stop-wheel.png');
const GLOW_ANIMATION = require('@/assets/animations/glow.json');
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
const POINT_TO_GRADIENT: Record<number, OutlineFillVariant> = {
  1000: 'green',
  100: 'yellow',
  750: 'purple',
  1500: 'yellow',
  500: 'purple',
  75: 'green',
  2000: 'yellow',
  10000: 'purple',
};
// Keyed by landing angle rather than points so the fill matches the sector the
// wheel actually rests on, including when we fall back to a random angle.
const LANDING_ANGLE_TO_GRADIENT = Object.entries(POINT_LANDING_ANGLES).reduce<
  Record<number, OutlineFillVariant>
>((acc, [points, angle]) => {
  const variant = POINT_TO_GRADIENT[Number(points)];
  if (variant) acc[angle] = variant;
  return acc;
}, {});
const WHEEL_FRAME_SIZE = 700;
const WHEEL_IMAGE_SIZE = 800;
const GLOW_SIZE = 800;
// How long the winning wedge takes to fade in once the wheel comes to rest. Must
// stay well inside the hold before the win overlay mounts.
const OUTLINE_FILL_FADE_MS = 650;
const FLASH_RISE_MS = 420;
// Flash geometry lives in the outline's own 304x418 space. The wedge runs from its
// rim (y~90) down to the tip at (152, 390). Nudge `left`/`top` to reposition.
const LEFT_FLASH = { left: 70, top: 100, width: 92, height: 148 };
const RIGHT_FLASH = { left: 146, top: 165, width: 149, height: 174 };
// How far below its resting spot each bolt starts before rising into place.
const FLASH_RISE_DISTANCE = 56;
// The path only occupies ~90% of its 304-unit viewBox. Render it wider so the
// visible edges align with the wheel's 45-degree segment at the colored rim.
const OUTLINE_WIDTH = 306;
const OUTLINE_HEIGHT = 418;
const OUTLINE_TOP = -48;
const TRIANGLE_WIDTH = 112;
const WHEEL_IMAGE_OFFSET = (WHEEL_FRAME_SIZE - WHEEL_IMAGE_SIZE) / 2;
const GLOW_OFFSET = (WHEEL_FRAME_SIZE - GLOW_SIZE) / 2;
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
  const glowRef = useRef<LottieView>(null);
  const isSpinningRef = useRef(false);
  const pendingPointsRef = useRef<number | undefined>(undefined);

  const outlineOpacity = useRef(new Animated.Value(0)).current;
  const outlineTranslateY = useRef(new Animated.Value(-430)).current;
  const outlineFillOpacity = useRef(new Animated.Value(0)).current;
  const restAnimationRef = useRef<Animated.CompositeAnimation | null>(null);
  const [outlineFillVariant, setOutlineFillVariant] = useState<OutlineFillVariant>('green');

  // One progress value per bolt drives its travel and opacity together.
  const leftFlashRise = useRef(new Animated.Value(0)).current;
  const rightFlashRise = useRef(new Animated.Value(0)).current;

  // Each bolt rises into place from below while fading in.
  const flashStyle = (rise: Animated.Value) => ({
    opacity: rise,
    transform: [
      {
        translateY: rise.interpolate({
          inputRange: [0, 1],
          outputRange: [FLASH_RISE_DISTANCE, 0],
        }),
      },
    ],
  });

  const triangleTranslateY = useRef(new Animated.Value(-18)).current;
  const triangleOpacity = useRef(new Animated.Value(0)).current;
  const selectorAnimationRef = useRef<Animated.CompositeAnimation | null>(null);

  const glowPulse = useRef(new Animated.Value(-1)).current;
  const glowPulseAnimationRef = useRef<Animated.CompositeAnimation | null>(null);

  const startSpin = useCallback(async () => {
    if (disabled || isSpinningRef.current) return;

    isSpinningRef.current = true;

    // Glow rises from the wheel the moment the button is pressed.
    glowRef.current?.reset();
    glowRef.current?.play();

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

    // The wedge fill and flashes only appear once the wheel has come to rest.
    restAnimationRef.current?.stop();
    restAnimationRef.current = null;
    outlineFillOpacity.setValue(0);
    leftFlashRise.setValue(0);
    rightFlashRise.setValue(0);

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
      setOutlineFillVariant(LANDING_ANGLE_TO_GRADIENT[landingAngle] ?? 'green');
      wheelRef.current?.land(landingAngle);
    } catch (error) {
      wheelRef.current?.stop();
      glowRef.current?.reset();
      glowPulseAnimationRef.current?.stop();
      glowPulseAnimationRef.current = null;
      glowPulse.setValue(-1);
      isSpinningRef.current = false;
      onSpinError?.(error);
    }
  }, [
    disabled,
    glowPulse,
    leftFlashRise,
    rightFlashRise,
    onSpin,
    onSpinError,
    outlineFillOpacity,
    outlineOpacity,
    outlineTranslateY,
    triangleOpacity,
    triangleTranslateY,
  ]);

  useEffect(() => {
    return () => {
      selectorAnimationRef.current?.stop();
      glowPulseAnimationRef.current?.stop();
      restAnimationRef.current?.stop();
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
              glowRef.current?.reset();
              glowPulseAnimationRef.current?.stop();
              glowPulseAnimationRef.current = null;
              glowPulse.setValue(-1);

              onSpinEnd?.(pendingPointsRef.current ?? 0);

              const restAnimation = Animated.sequence([
                // Eases in and out so the wedge reads as a gradual fade rather than
                // a snap — an ease-out here front-loads almost all of the change.
                Animated.timing(outlineFillOpacity, {
                  toValue: 1,
                  duration: OUTLINE_FILL_FADE_MS,
                  easing: Easing.inOut(Easing.quad),
                  useNativeDriver: true,
                }),

                // Both bolts then rise into place from below, fading in as they go
                // and decelerating into their resting spots.
                Animated.parallel(
                  [leftFlashRise, rightFlashRise].map(rise =>
                    Animated.timing(rise, {
                      toValue: 1,
                      duration: FLASH_RISE_MS,
                      easing: Easing.out(Easing.cubic),
                      useNativeDriver: true,
                    }),
                  ),
                ),
              ]);

              restAnimationRef.current = restAnimation;
              restAnimation.start(({ finished }) => {
                if (finished) restAnimationRef.current = null;
              });

              // onSpinEnd?.(pendingPointsRef.current ?? 0);
              pendingPointsRef.current = undefined;
            }}
          />
        </Animated.View>

        {/* Sits above the wheel image but below the outline, triangle and button. */}
        <LottieView
          ref={glowRef}
          source={GLOW_ANIMATION}
          loop={false}
          autoPlay={false}
          style={{
            position: 'absolute',
            top: GLOW_OFFSET,
            left: GLOW_OFFSET,
            width: GLOW_SIZE,
            height: GLOW_SIZE,
            zIndex: 1,
            pointerEvents: 'none',
          }}
        />

        {/* Green wedge fill, revealed once the wheel settles on its prize. */}
        <Animated.View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: OUTLINE_TOP,
            left: OUTLINE_LEFT,
            zIndex: 2,
            transform: [{ translateY: outlineTranslateY }],
            opacity: outlineFillOpacity,
          }}
        >
          <OutlineFill variant={outlineFillVariant} />
        </Animated.View>

        {/* Flash bolts, laid out in the outline's own 304x418 coordinate space. */}

        <Animated.View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: OUTLINE_TOP,
            left: OUTLINE_LEFT,
            zIndex: 2,
            transform: [{ translateY: outlineTranslateY }],
            opacity: outlineOpacity,
            overflow: 'hidden',
          }}
        >
          <Outline />
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: OUTLINE_WIDTH,
              height: OUTLINE_HEIGHT,
              zIndex: 4,
            }}
          >
            <Animated.View
              style={[
                { position: 'absolute', left: LEFT_FLASH.left, top: LEFT_FLASH.top },
                flashStyle(leftFlashRise),
              ]}
            >
              <LeftFlash variant={outlineFillVariant} />
            </Animated.View>

            <Animated.View
              style={[
                { position: 'absolute', left: RIGHT_FLASH.left, top: RIGHT_FLASH.top },
                flashStyle(rightFlashRise),
              ]}
            >
              <RightFlash variant={outlineFillVariant} />
            </Animated.View>
          </View>
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
