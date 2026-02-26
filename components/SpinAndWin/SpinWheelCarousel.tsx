import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, View } from 'react-native';
import LottieView from 'lottie-react-native';

import {
  getTargetAngle,
  prepareLottieSource,
  PRIZE_REVEAL_DELAY_MS,
} from '@/components/SpinAndWin/prepareLottieSource';
import { Text } from '@/components/ui/text';
import { SPIN_WIN } from '@/constants/spinWinDesign';

/** Native dimensions of the spin-wheel.json animation (wheel-only asset). */
const ANIMATION_WIDTH = 419;
const ANIMATION_HEIGHT = 440;

interface SpinWheelCarouselProps {
  onSpinComplete: (points: number) => void;
  isSpinning: boolean;
  resultPoints?: number;
}

export default function SpinWheelCarousel({
  onSpinComplete,
  isSpinning,
  resultPoints,
}: SpinWheelCarouselProps) {
  const lottieRef = useRef<LottieView>(null);
  const spinComplete = useRef(false);
  const revealTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Animated value for the prize text reveal (scale spring)
  const prizeScale = useRef(new Animated.Value(0)).current;
  const prizeOpacity = useRef(new Animated.Value(0)).current;
  const [showPrize, setShowPrize] = useState(false);

  // Prepare the Lottie source with the correct rotation for the result
  const lottieSource = useMemo(() => {
    if (resultPoints == null) {
      // Default source with reveal layers hidden but base rotation
      return prepareLottieSource(getTargetAngle(1000));
    }
    const angle = getTargetAngle(resultPoints);
    return prepareLottieSource(angle);
  }, [resultPoints]);

  // Start animation when spinning with a result
  useEffect(() => {
    if (isSpinning && resultPoints && !spinComplete.current) {
      spinComplete.current = true;

      // Small delay to ensure the new source is rendered before playing
      requestAnimationFrame(() => {
        lottieRef.current?.play();
      });

      // Schedule the prize text reveal
      revealTimer.current = setTimeout(() => {
        setShowPrize(true);
        // Animate scale from 0 -> 1 with a spring effect
        Animated.parallel([
          Animated.spring(prizeScale, {
            toValue: 1,
            friction: 6,
            tension: 100,
            useNativeDriver: true,
          }),
          Animated.timing(prizeOpacity, {
            toValue: 1,
            duration: 200,
            useNativeDriver: true,
          }),
        ]).start();
      }, PRIZE_REVEAL_DELAY_MS);
    }
  }, [isSpinning, resultPoints, prizeScale, prizeOpacity]);

  // Reset when not spinning
  useEffect(() => {
    if (!isSpinning) {
      spinComplete.current = false;
      lottieRef.current?.reset();

      // Clear any pending reveal timer
      if (revealTimer.current) {
        clearTimeout(revealTimer.current);
        revealTimer.current = null;
      }

      // Reset prize overlay state
      setShowPrize(false);
      prizeScale.setValue(0);
      prizeOpacity.setValue(0);
    }
  }, [isSpinning, prizeScale, prizeOpacity]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (revealTimer.current) {
        clearTimeout(revealTimer.current);
      }
    };
  }, []);

  const handleAnimationFinish = useCallback(
    (isCancelled: boolean) => {
      if (!isCancelled && resultPoints) {
        onSpinComplete(resultPoints);
      }
    },
    [onSpinComplete, resultPoints],
  );

  return (
    <View
      style={{
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        overflow: 'hidden',
      }}
    >
      {/* Lottie spin wheel animation — 120% width for zoom, aspect ratio preserved */}
      <LottieView
        ref={lottieRef}
        source={lottieSource}
        loop={false}
        autoPlay={false}
        style={{
          width: '120%',
          aspectRatio: ANIMATION_WIDTH / ANIMATION_HEIGHT,
        }}
        resizeMode="cover"
        onAnimationFinish={handleAnimationFinish}
      />

      {/* Animated prize reveal overlay – appears after wheel settles */}
      {showPrize && resultPoints != null && (
        <Animated.View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            justifyContent: 'center',
            alignItems: 'center',
            transform: [{ scale: prizeScale }],
            opacity: prizeOpacity,
          }}
        >
          <View
            style={{
              backgroundColor: 'rgba(0,0,0,0.55)',
              borderRadius: 16,
              paddingHorizontal: 24,
              paddingVertical: 12,
            }}
          >
            <Text
              style={{
                fontSize: SPIN_WIN.typography.titleSize,
                fontWeight: SPIN_WIN.typography.titleWeight,
                color: SPIN_WIN.colors.gold,
                textAlign: 'center',
                fontVariant: ['tabular-nums'],
              }}
            >
              +{resultPoints.toLocaleString()}
            </Text>
          </View>
        </Animated.View>
      )}
    </View>
  );
}
