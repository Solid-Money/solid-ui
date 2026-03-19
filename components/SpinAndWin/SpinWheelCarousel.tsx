import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, View } from 'react-native';
import LottieView from 'lottie-react-native';

import {
  ANIMATION_FPS,
  getTargetAngle,
  prepareLottieSource,
  TARGET_PATCH_START_FRAME,
} from '@/components/SpinAndWin/prepareLottieSource';
import { Text } from '@/components/ui/text';
import { SPIN_WIN } from '@/constants/spinWinDesign';

const ANIMATION_WIDTH = 419;
const ANIMATION_HEIGHT = 810;
const RESULT_REVEAL_HOLD_MS = 450;

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
  const spinStarted = useRef(false);
  const handoffReached = useRef(false);
  const pendingResultPoints = useRef<number | undefined>(undefined);
  const handoffTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const targetedSpinStartRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const completionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const prizeScale = useRef(new Animated.Value(0)).current;
  const prizeOpacity = useRef(new Animated.Value(0)).current;
  const [showPrize, setShowPrize] = useState(false);
  const [playbackResultPoints, setPlaybackResultPoints] = useState<number | undefined>();

  const lottieSource = useMemo(() => {
    const targetPoints = playbackResultPoints ?? 10000;
    return prepareLottieSource(getTargetAngle(targetPoints));
  }, [playbackResultPoints]);

  const resetPrizeReveal = useCallback(() => {
    setShowPrize(false);
    prizeScale.setValue(0);
    prizeOpacity.setValue(0);
  }, [prizeOpacity, prizeScale]);

  const revealPrize = useCallback(() => {
    setShowPrize(true);
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
  }, [prizeOpacity, prizeScale]);

  useEffect(() => {
    if (!isSpinning || spinStarted.current) {
      return;
    }

    spinStarted.current = true;
    handoffReached.current = false;
    pendingResultPoints.current = resultPoints;
    setPlaybackResultPoints(undefined);
    resetPrizeReveal();

    lottieRef.current?.play(0, TARGET_PATCH_START_FRAME);

    const handoffDelayMs = (TARGET_PATCH_START_FRAME / ANIMATION_FPS) * 1000;
    handoffTimerRef.current = setTimeout(() => {
      handoffReached.current = true;

      if (pendingResultPoints.current != null) {
        setPlaybackResultPoints(pendingResultPoints.current);
      }
    }, handoffDelayMs);
  }, [isSpinning, resetPrizeReveal, resultPoints]);

  useEffect(() => {
    pendingResultPoints.current = resultPoints;

    if (!isSpinning || resultPoints == null || !handoffReached.current) {
      return;
    }

    setPlaybackResultPoints(resultPoints);
  }, [isSpinning, resultPoints]);

  useEffect(() => {
    if (!isSpinning || playbackResultPoints == null) {
      return;
    }

    targetedSpinStartRef.current = setTimeout(() => {
      lottieRef.current?.play(TARGET_PATCH_START_FRAME);
    }, 50);

    return () => {
      if (targetedSpinStartRef.current) {
        clearTimeout(targetedSpinStartRef.current);
      }
    };
  }, [isSpinning, playbackResultPoints]);

  useEffect(() => {
    if (!isSpinning) {
      spinStarted.current = false;
      handoffReached.current = false;
      pendingResultPoints.current = undefined;
      setPlaybackResultPoints(undefined);

      if (handoffTimerRef.current) {
        clearTimeout(handoffTimerRef.current);
        handoffTimerRef.current = null;
      }

      if (completionTimerRef.current) {
        clearTimeout(completionTimerRef.current);
        completionTimerRef.current = null;
      }

      lottieRef.current?.reset();
      resetPrizeReveal();
    }
  }, [isSpinning, resetPrizeReveal]);

  useEffect(() => {
    return () => {
      if (handoffTimerRef.current) {
        clearTimeout(handoffTimerRef.current);
      }
      if (targetedSpinStartRef.current) {
        clearTimeout(targetedSpinStartRef.current);
      }
      if (completionTimerRef.current) {
        clearTimeout(completionTimerRef.current);
      }
    };
  }, []);

  const handleAnimationFinish = useCallback(
    (isCancelled: boolean) => {
      if (!isCancelled && playbackResultPoints != null) {
        revealPrize();

        if (completionTimerRef.current) {
          clearTimeout(completionTimerRef.current);
        }

        completionTimerRef.current = setTimeout(() => {
          onSpinComplete(playbackResultPoints);
        }, RESULT_REVEAL_HOLD_MS);
      }
    },
    [onSpinComplete, playbackResultPoints, revealPrize],
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
      <LottieView
        key={playbackResultPoints ?? 'idle'}
        ref={lottieRef}
        source={lottieSource}
        loop={false}
        autoPlay={false}
        style={{
          width: '100%',
          maxWidth: ANIMATION_WIDTH,
          aspectRatio: ANIMATION_WIDTH / ANIMATION_HEIGHT,
          marginBottom: 200,
        }}
        resizeMode="cover"
        onAnimationFinish={handleAnimationFinish}
      />

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
