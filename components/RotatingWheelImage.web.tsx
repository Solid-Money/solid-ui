import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef } from 'react';
import { Image, StyleSheet } from 'react-native';

import type { RotatingWheelImageHandle, RotatingWheelImageProps } from './RotatingWheelImage';
import type { CSSProperties } from 'react';

const DEFAULT_SIZE = 300;
const DEFAULT_DURATION = 5000;
const DEFAULT_TURNS = 6;
const FULL_ROTATION = 360;
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
    const imageRef = useRef<HTMLImageElement>(null);
    const currentRotationRef = useRef(0);
    const cruiseAnimationRef = useRef<Animation | null>(null);
    const landingAnimationRef = useRef<Animation | null>(null);

    const cancelAnimations = useCallback(() => {
      cruiseAnimationRef.current?.cancel();
      landingAnimationRef.current?.cancel();
      cruiseAnimationRef.current = null;
      landingAnimationRef.current = null;
    }, []);

    const reset = useCallback(() => {
      const image = imageRef.current;

      cancelAnimations();
      currentRotationRef.current = 0;

      if (!image) return;

      image.style.transform = 'rotate(0deg)';
    }, [cancelAnimations]);

    const startCruise = useCallback(() => {
      const image = imageRef.current;
      if (!image || cruiseAnimationRef.current || landingAnimationRef.current) return;

      const startRotation = currentRotationRef.current;
      cruiseAnimationRef.current = image.animate(
        [
          { transform: `rotate(${startRotation}deg)` },
          { transform: `rotate(${startRotation + FULL_ROTATION}deg)` },
        ],
        {
          duration: CRUISE_TURN_DURATION,
          easing: 'linear',
          iterations: Infinity,
        },
      );
    }, []);

    const land = useCallback(
      (targetAngle: number) => {
        const image = imageRef.current;
        if (!image || landingAnimationRef.current) return;

        const finalAngle = normalizeAngle(Number.isFinite(targetAngle) ? targetAngle : 0);
        const cruiseAnimation = cruiseAnimationRef.current;
        const elapsed = Number(cruiseAnimation?.currentTime ?? 0);
        const currentRotation =
          currentRotationRef.current + (elapsed / CRUISE_TURN_DURATION) * FULL_ROTATION;

        cruiseAnimation?.cancel();
        cruiseAnimationRef.current = null;
        currentRotationRef.current = currentRotation;
        image.style.transform = `rotate(${currentRotation}deg)`;

        const currentAngle = normalizeAngle(currentRotation);
        const angleToTarget = normalizeAngle(finalAngle - currentAngle);
        const fullTurns = Number.isFinite(turns) ? Math.max(3, Math.floor(turns)) : DEFAULT_TURNS;
        const spinDuration = Number.isFinite(duration)
          ? Math.min(7000, Math.max(5000, duration))
          : DEFAULT_DURATION;
        const destination = currentRotation + fullTurns * FULL_ROTATION + angleToTarget;
        const cruiseAngle = destination - Math.min(2 * FULL_ROTATION, fullTurns * 180);

        const animation = image.animate(
          [
            {
              transform: `rotate(${currentRotation}deg)`,
              easing: 'cubic-bezier(0.45, 0, 0.8, 0.45)',
            },
            {
              transform: `rotate(${currentRotation + 0.8 * FULL_ROTATION}deg)`,
              offset: 0.12,
              easing: 'linear',
            },
            {
              transform: `rotate(${cruiseAngle}deg)`,
              offset: 0.55,
              easing: 'cubic-bezier(0.12, 0.65, 0.18, 1)',
            },
            {
              transform: `rotate(${destination - 18}deg)`,
              offset: 0.84,
              easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
            },
            { transform: `rotate(${destination + 6}deg)`, offset: 0.92, easing: 'ease-out' },
            { transform: `rotate(${destination - 2}deg)`, offset: 0.97, easing: 'ease-in-out' },
            { transform: `rotate(${destination}deg)` },
          ],
          { duration: spinDuration, fill: 'forwards' },
        );
        landingAnimationRef.current = animation;

        animation.onfinish = () => {
          currentRotationRef.current = destination;
          image.style.transform = `rotate(${destination}deg)`;
          animation.cancel();
          landingAnimationRef.current = null;
          onSpinEnd?.(finalAngle);
        };
      },
      [duration, onSpinEnd, turns],
    );

    const stop = useCallback(() => {
      const image = imageRef.current;
      const cruiseAnimation = cruiseAnimationRef.current;

      if (image && cruiseAnimation) {
        const elapsed = Number(cruiseAnimation.currentTime ?? 0);
        currentRotationRef.current += (elapsed / CRUISE_TURN_DURATION) * FULL_ROTATION;
        image.style.transform = `rotate(${currentRotationRef.current}deg)`;
      }

      cancelAnimations();
    }, [cancelAnimations]);

    useImperativeHandle(ref, () => ({ startCruise, land, stop, reset }), [
      land,
      reset,
      startCruise,
      stop,
    ]);

    useEffect(() => cancelAnimations, [cancelAnimations]);

    const resolvedSource = Image.resolveAssetSource(source);
    const flattenedStyle = StyleSheet.flatten(style) as CSSProperties | undefined;
    const imageStyle = { width: size, height: size, ...flattenedStyle } as CSSProperties;

    return (
      <img
        ref={imageRef}
        className="rotating-wheel-image"
        src={resolvedSource?.uri}
        alt=""
        draggable={false}
        style={imageStyle}
      />
    );
  },
);

export type { RotatingWheelImageHandle, RotatingWheelImageProps };
export default RotatingWheelImage;
