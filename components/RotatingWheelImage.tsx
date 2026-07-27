import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef } from 'react';
import { Animated, Easing, ImageSourcePropType, ImageStyle, StyleProp } from 'react-native';

export type RotatingWheelImageProps = {
  source: ImageSourcePropType;
  size?: number;
  duration?: number;
  turns?: number;
  style?: StyleProp<ImageStyle>;
  onSpinEnd?: (finalAngle: number) => void;
};

export type RotatingWheelImageHandle = {
  startCruise: () => void;
  land: (targetAngle: number) => void;
  stop: () => void;
  reset: () => void;
};

const DEFAULT_SIZE = 300;
const DEFAULT_DURATION = 6734;
const DEFAULT_TURNS = 6;
const FULL_ROTATION = 360;
const BASE_SEQUENCE_DURATION = 6734;
const CRUISE_TURN_DURATION = 700;

function normalizeAngle(angle: number): number {
  return ((angle % FULL_ROTATION) + FULL_ROTATION) % FULL_ROTATION;
}

const RotatingWheelImage = forwardRef<RotatingWheelImageHandle, RotatingWheelImageProps>(
  function RotatingWheelImage(
    {
      source,
      size = DEFAULT_SIZE,
      duration = DEFAULT_DURATION,
      turns = DEFAULT_TURNS,
      style,
      onSpinEnd,
    },
    ref,
  ) {
    const rotation = useRef(new Animated.Value(0)).current;
    const currentRotationRef = useRef(0);
    const isCruisingRef = useRef(false);
    const animationRef = useRef<Animated.CompositeAnimation | null>(null);
    const animationIdRef = useRef(0);
    const isMountedRef = useRef(true);

    const reset = useCallback(() => {
      animationIdRef.current += 1;
      animationRef.current?.stop();
      animationRef.current = null;
      isCruisingRef.current = false;
      currentRotationRef.current = 0;
      rotation.setValue(0);
    }, [rotation]);

    const startCruise = useCallback(() => {
      if (isCruisingRef.current || animationRef.current) return;

      isCruisingRef.current = true;

      const runTurn = () => {
        if (!isCruisingRef.current || !isMountedRef.current) return;

        const destination = currentRotationRef.current + FULL_ROTATION;
        const animation = Animated.timing(rotation, {
          toValue: destination,
          duration: CRUISE_TURN_DURATION,
          easing: Easing.linear,
          useNativeDriver: true,
        });

        animationRef.current = animation;
        animation.start(({ finished }) => {
          if (!finished || !isCruisingRef.current || !isMountedRef.current) return;

          currentRotationRef.current = destination;
          animationRef.current = null;
          runTurn();
        });
      };

      runTurn();
    }, [rotation]);

    const land = useCallback(
      (targetAngle: number) => {
        const finalAngle = normalizeAngle(Number.isFinite(targetAngle) ? targetAngle : 0);

        isCruisingRef.current = false;
        animationRef.current?.stop();
        animationRef.current = null;

        rotation.stopAnimation(currentRotation => {
          currentRotationRef.current = currentRotation;

          const currentAngle = normalizeAngle(currentRotation);
          const angleToTarget = normalizeAngle(finalAngle - currentAngle);
          const fullTurns = Math.max(1, Math.floor(turns));
          const destination = currentRotation + fullTurns * FULL_ROTATION + angleToTarget;
          const animationId = ++animationIdRef.current;
          const safeDuration = Number.isFinite(duration) ? Math.max(1, duration) : DEFAULT_DURATION;
          const durationScale = safeDuration / BASE_SEQUENCE_DURATION;
          const scaleDuration = (stageDuration: number) =>
            Math.max(1, Math.round(stageDuration * durationScale));

          const animation = Animated.sequence([
            Animated.timing(rotation, {
              toValue: destination + 23,
              duration: scaleDuration(5000),
              easing: Easing.bezier(0.12, 0.65, 0.18, 1),
              useNativeDriver: true,
            }),
            Animated.timing(rotation, {
              toValue: destination - 5,
              duration: scaleDuration(967),
              easing: Easing.bezier(0.63, 0, 0.462, 1),
              useNativeDriver: true,
            }),
            Animated.timing(rotation, {
              toValue: destination + 2,
              duration: scaleDuration(400),
              easing: Easing.bezier(0.525, 0, 0.464, 1),
              useNativeDriver: true,
            }),
            Animated.timing(rotation, {
              toValue: destination,
              duration: scaleDuration(367),
              easing: Easing.bezier(0.467, 0, 1, 1),
              useNativeDriver: true,
            }),
          ]);

          animationRef.current = animation;
          animation.start(({ finished }) => {
            if (!isMountedRef.current || animationId !== animationIdRef.current) return;

            animationRef.current = null;

            if (!finished) return;

            currentRotationRef.current = destination;
            onSpinEnd?.(finalAngle);
          });
        });
      },
      [duration, onSpinEnd, rotation, turns],
    );

    const stop = useCallback(() => {
      isCruisingRef.current = false;
      animationIdRef.current += 1;
      animationRef.current?.stop();
      animationRef.current = null;
      rotation.stopAnimation(currentRotation => {
        currentRotationRef.current = currentRotation;
      });
    }, [rotation]);

    useImperativeHandle(ref, () => ({ startCruise, land, stop, reset }), [
      land,
      reset,
      startCruise,
      stop,
    ]);

    useEffect(() => {
      return () => {
        isMountedRef.current = false;
        isCruisingRef.current = false;
        animationIdRef.current += 1;
        animationRef.current?.stop();
        animationRef.current = null;
      };
    }, []);

    const rotate = rotation.interpolate({
      inputRange: [0, FULL_ROTATION],
      outputRange: ['0deg', '360deg'],
      extrapolate: 'extend',
    });

    return (
      <Animated.Image
        source={source}
        resizeMode="contain"
        style={[{ width: size, height: size }, style, { transform: [{ rotate }] }]}
      />
    );
  },
);

export default RotatingWheelImage;
