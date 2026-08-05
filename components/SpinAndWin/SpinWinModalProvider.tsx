import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  TouchableOpacity,
  View,
} from 'react-native';
import Reanimated, {
  Easing as ReanimatedEasing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import LottieView from 'lottie-react-native';
import { useShallow } from 'zustand/react/shallow';

import { FAQ } from '@/components/FAQ';
import ResponsiveModal from '@/components/ResponsiveModal';
import ConfettiOverlay from '@/components/SpinAndWin/ConfettiOverlay';
import PrizePoolCard from '@/components/SpinAndWin/PrizePoolCard';
import PrizeWheel from '@/components/SpinAndWin/PrizeWheel';
import StreakTracker from '@/components/SpinAndWin/StreakTracker';
import { Text } from '@/components/ui/text';
import { SPIN_WIN_MODAL } from '@/constants/modals';
import { SPIN_WIN } from '@/constants/spinWinDesign';
import { useCurrentGiveaway, useGiveawayCountdown, useGiveawayWinners } from '@/hooks/useGiveaway';
import { usePerformSpin, useSpinStatus } from '@/hooks/useSpinWin';
import { isProduction } from '@/lib/config';
import { Faq } from '@/lib/types';
import { useSpinWinModalStore } from '@/store/useSpinWinModalStore';
import { useSpinWinStore } from '@/store/useSpinWinStore';

const WIN_SCREEN_ANIMATION = require('@/assets/animations/win_screen_2.json');

const SPIN_WIN_FAQS = [
  {
    question: 'How does Spin & Win work?',
    answer:
      'Spin the wheel once every day to earn points. Maintain a 7-day streak to qualify for the weekly giveaway drawing.',
  },
  {
    question: 'How do I qualify for the giveaway?',
    answer:
      'Spin the wheel for 7 consecutive days to maintain a full streak. Once qualified, you are entered into the weekly prize pool drawing.',
  },
  {
    question: 'What happens if I miss a day?',
    answer:
      'Your streak resets to zero and you will need to start a new 7-day streak to qualify for the next giveaway.',
  },
  {
    question: 'How are winners selected?',
    answer:
      'Winners are selected randomly from all qualified participants at the end of each weekly period.',
  },
  {
    question: 'What is the minimum deposit to participate?',
    answer: 'You need to maintain a savings balance of at least $50 to be eligible for Spin & Win.',
  },
] as unknown as Faq[];

type HeaderProps = {
  title?: string;
  onClose: () => void;
  onBack?: () => void;
  showTitle?: boolean;
};

function SpinWinHeader({ title = 'Spin & Win', onClose, onBack, showTitle = true }: HeaderProps) {
  const insets = useSafeAreaInsets();

  return (
    <View
      style={{
        paddingTop: Math.max(insets.top, 12),
        paddingHorizontal: 16,
        paddingBottom: 12,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}
    >
      {onBack ? (
        <TouchableOpacity
          onPress={onBack}
          style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: 'rgba(255,255,255,0.1)',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ionicons name="chevron-back" size={22} color={SPIN_WIN.colors.textPrimary} />
        </TouchableOpacity>
      ) : (
        <View style={{ width: 40, height: 40 }} />
      )}

      <View style={{ flex: 1, alignItems: 'center' }}>
        {showTitle ? (
          <Text
            style={{
              fontSize: 20,
              fontWeight: '600',
              color: SPIN_WIN.colors.textPrimary,
            }}
          >
            {title}
          </Text>
        ) : null}
      </View>

      <TouchableOpacity
        onPress={onClose}
        style={{
          width: 40,
          height: 40,
          borderRadius: 20,
          backgroundColor: 'rgba(255,255,255,0.1)',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Ionicons name="close" size={22} color={SPIN_WIN.colors.textPrimary} />
      </TouchableOpacity>
    </View>
  );
}

function SpinWinHomeScreen({ onClose, onSpin }: { onClose: () => void; onSpin: () => void }) {
  const { data: spinStatus, isLoading: isStatusLoading } = useSpinStatus();
  const { data: giveaway } = useCurrentGiveaway();
  const { data: winners } = useGiveawayWinners();
  const countdown = useGiveawayCountdown(giveaway?.giveawayDate);

  useEffect(() => {
    // Spin & Win is native-only and an in-development feature (hidden in
    // production); it also closes once the backend says the user isn't eligible.
    if (
      Platform.OS === 'web' ||
      isProduction ||
      (!isStatusLoading && spinStatus?.isAllowed === false)
    ) {
      onClose();
    }
  }, [isStatusLoading, onClose, spinStatus?.isAllowed]);

  const canSpin = spinStatus?.spinAvailableToday && spinStatus?.isEligible;

  if (isStatusLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: SPIN_WIN.colors.background }}>
        <SpinWinHeader onClose={onClose} showTitle={false} />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={SPIN_WIN.colors.gold} />
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: SPIN_WIN.colors.background }}>
      <SpinWinHeader onClose={onClose} showTitle={false} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 24 }}
      >
        <View className="mx-auto w-full max-w-7xl px-4 pb-24 pt-2" style={{ gap: 24 }}>
          <View style={{ alignItems: 'center' }}>
            <View
              style={{
                width: SPIN_WIN.hero.imageSize,
                height: SPIN_WIN.hero.imageSize,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Image
                source={require('@/assets/images/spin-win/piggy-bank-3d.png')}
                style={{
                  width: SPIN_WIN.hero.imageSize,
                  height: SPIN_WIN.hero.imageSize,
                }}
                contentFit="contain"
              />
            </View>

            <Text
              style={{
                fontSize: SPIN_WIN.typography.titleSize,
                fontWeight: SPIN_WIN.typography.titleWeight,
                color: SPIN_WIN.colors.textPrimary,
                textAlign: 'center',
                letterSpacing: -3,
                marginTop: -8,
              }}
            >
              Spin & Win
            </Text>

            <Text
              style={{
                fontSize: SPIN_WIN.typography.subtitleSize,
                fontWeight: SPIN_WIN.typography.subtitleWeight,
                color: SPIN_WIN.colors.subtitleText,
                textAlign: 'center',
                marginTop: 8,
                paddingHorizontal: 16,
                lineHeight: 22,
              }}
            >
              Spin the wheel to get point. Complete your 7-day streak to qualify to the week&apos;s
              prize pool!
            </Text>
          </View>

          <View style={{ gap: 12 }}>
            <Text
              style={{
                fontSize: SPIN_WIN.typography.bodySize,
                fontWeight: '500',
                color: SPIN_WIN.colors.goldTransparent,
                textAlign: 'center',
              }}
            >
              Your daily streak
            </Text>

            <StreakTracker
              currentStreak={spinStatus?.currentStreak ?? 0}
              spinAvailableToday={spinStatus?.spinAvailableToday ?? false}
            />

            <Text
              style={{
                fontSize: SPIN_WIN.typography.bodySize,
                fontWeight: '500',
                color: SPIN_WIN.colors.goldTransparent,
                textAlign: 'center',
              }}
            >
              Complete your 7-day streak to qualify!
            </Text>
          </View>

          <Pressable onPress={canSpin ? onSpin : undefined} disabled={!canSpin}>
            <View
              style={{
                backgroundColor: canSpin ? SPIN_WIN.colors.gold : SPIN_WIN.colors.ctaDisabledBg,
                borderRadius: SPIN_WIN.borderRadius.button,
                borderCurve: 'continuous',
                paddingVertical: 16,
                alignItems: 'center',
                width: '100%',
                maxWidth: 388,
                alignSelf: 'center',
              }}
            >
              <Text
                style={{
                  fontSize: SPIN_WIN.typography.ctaSize,
                  fontWeight: SPIN_WIN.typography.ctaWeight,
                  color: canSpin ? '#000000' : SPIN_WIN.colors.ctaDisabledText,
                }}
              >
                {spinStatus?.spinAvailableToday ? 'Spin the wheel' : 'Already Spun Today'}
              </Text>
            </View>
          </Pressable>

          {giveaway && (
            <PrizePoolCard
              prizePool={giveaway.prizePool}
              countdown={countdown}
              qualifiedCount={giveaway.qualifiedCount}
              status={giveaway.status}
              winners={winners}
            />
          )}

          <View style={{ gap: 12 }}>
            <Text
              style={{
                fontSize: SPIN_WIN.typography.headingSize,
                fontWeight: SPIN_WIN.typography.headingWeight,
                color: SPIN_WIN.colors.textPrimary,
              }}
            >
              FAQ
            </Text>
            <FAQ faqs={SPIN_WIN_FAQS} />
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

function SpinWinWheelScreen({
  onClose,
  onBack,
  onSpinFinished,
}: {
  onClose: () => void;
  onBack: () => void;
  onSpinFinished: (points: number) => void;
}) {
  const { mutateAsync: performSpin } = usePerformSpin();
  const [resultPoints, setResultPoints] = useState<number | null>(null);

  const onSpin = useCallback(async () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    }

    try {
      const spinResult = await performSpin();
      if (spinResult) {
        return spinResult.pointsEarned;
      }
    } catch (error) {
      console.error('Error performing spin:', error);
    }
  }, [performSpin]);

  const handleSpinComplete = useCallback((points: number) => {
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }

    setTimeout(() => {
      setResultPoints(points);
    }, 500);
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: SPIN_WIN.colors.background }}>
      <SpinWinHeader title="Spin & Win" onBack={onBack} onClose={onClose} />

      <View style={{ flex: 1, alignItems: 'center', overflow: 'hidden' }}>
        <PrizeWheel onSpin={onSpin} onSpinEnd={handleSpinComplete} />
      </View>

      {resultPoints !== null ? (
        <SpinWinResultScreen
          points={resultPoints}
          onContinue={() => onSpinFinished(resultPoints)}
        />
      ) : null}
    </View>
  );
}

function SpinWinResultScreen({ points, onContinue }: { points: number; onContinue: () => void }) {
  const prizeCardOffset = useSharedValue(280);
  const buttonOpacity = useSharedValue(0);
  const buttonOffset = useSharedValue(24);

  useEffect(() => {
    prizeCardOffset.value = withDelay(
      367,
      withSpring(0, {
        mass: 1,
        stiffness: 80,
        damping: 9,
        velocity: 0,
        overshootClamping: false,
      }),
    );
    buttonOpacity.value = withDelay(1200, withTiming(1, { duration: 250 }));
    buttonOffset.value = withDelay(
      1200,
      withTiming(0, {
        duration: 300,
        easing: ReanimatedEasing.out(ReanimatedEasing.cubic),
      }),
    );

    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  }, [buttonOffset, buttonOpacity, prizeCardOffset]);

  const prizeCardAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: prizeCardOffset.value }],
  }));

  const buttonAnimatedStyle = useAnimatedStyle(() => ({
    opacity: buttonOpacity.value,
    transform: [{ translateY: buttonOffset.value }],
  }));

  return (
    <View
      style={{
        position: 'absolute',
        top: 0,
        right: 0,
        bottom: 0,
        left: 0,
        zIndex: 20,
        overflow: 'hidden',
      }}
    >
      <BlurView
        pointerEvents="none"
        intensity={24}
        tint="dark"
        style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }}
      />

      <LinearGradient
        pointerEvents="none"
        colors={[
          'rgba(0,0,0,0.38)',
          'rgba(8,8,8,0.46)',
          'rgba(92,36,105,0.48)',
          'rgba(190,78,220,0.86)',
        ]}
        locations={[0, 0.42, 0.7, 1]}
        style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }}
      />

      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'flex-end',
          paddingHorizontal: 28,
          paddingBottom: 28,
        }}
      >
        <LottieView
          source={WIN_SCREEN_ANIMATION}
          autoPlay
          loop={false}
          resizeMode="contain"
          style={{
            position: 'absolute',
            top: 0,
            right: 0,
            bottom: 0,
            left: 0,
            zIndex: 3,
          }}
        />

        <Reanimated.View
          style={[
            {
              width: '100%',
              maxWidth: 270,
              height: 164,
              borderRadius: 20,
              borderWidth: 4,
              borderColor: '#61C95A',
              backgroundColor: '#94EB80',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 28,
              zIndex: 2,
            },
            prizeCardAnimatedStyle,
          ]}
        >
          <Text
            style={{
              color: '#000000',
              fontSize: 76,
              lineHeight: 84,
              letterSpacing: -3,
            }}
          >
            {points.toLocaleString()}
          </Text>
        </Reanimated.View>

        <Reanimated.View
          style={[
            {
              width: '100%',
              maxWidth: 388,
              zIndex: 4,
            },
            buttonAnimatedStyle,
          ]}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Claim ${points.toLocaleString()} points now`}
            onPress={onContinue}
            style={{
              width: '100%',
              minHeight: 60,
              borderRadius: SPIN_WIN.borderRadius.button,
              backgroundColor: '#000000',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text
                style={{
                  fontSize: SPIN_WIN.typography.ctaSize,
                  fontWeight: SPIN_WIN.typography.ctaWeight,
                  color: '#FFFFFF',
                }}
              >
                Claim
              </Text>
              <Image
                source={require('@/assets/images/reward-star.png')}
                style={{ width: 23, height: 27, marginHorizontal: 5 }}
                contentFit="contain"
              />
              <Text
                style={{
                  fontSize: SPIN_WIN.typography.ctaSize,
                  fontWeight: SPIN_WIN.typography.ctaWeight,
                  color: '#FFFFFF',
                }}
              >
                {points.toLocaleString()} Now
              </Text>
            </View>
          </Pressable>
        </Reanimated.View>
      </View>
    </View>
  );
}

function SpinWinSummaryScreen({ onClose, onBack }: { onClose: () => void; onBack: () => void }) {
  const currentStreak = useSpinWinStore(state => state.currentStreak);
  const spinAvailableToday = useSpinWinStore(state => state.spinAvailableToday);
  const { data: giveaway } = useCurrentGiveaway();
  const countdown = useGiveawayCountdown(giveaway?.giveawayDate);

  const prizePool = giveaway?.prizePool ?? 0;
  const formattedPrize = `$${prizePool.toLocaleString()}`;

  return (
    <View style={{ flex: 1, backgroundColor: SPIN_WIN.colors.background }}>
      <SpinWinHeader title="Spin & Win" onBack={onBack} onClose={onClose} />

      <View className="flex-1 items-center justify-center px-4">
        <LinearGradient
          colors={[SPIN_WIN.gradient.prizePoolColors[0], SPIN_WIN.gradient.prizePoolColors[1]]}
          start={SPIN_WIN.gradient.prizePoolStart}
          end={SPIN_WIN.gradient.prizePoolEnd}
          style={{
            borderRadius: SPIN_WIN.borderRadius.card,
            overflow: 'hidden',
            width: '100%',
            maxWidth: 388,
            alignSelf: 'center',
          }}
        >
          <View style={{ paddingHorizontal: 20, paddingTop: 24, paddingBottom: 20, gap: 12 }}>
            <Text
              style={{
                fontSize: SPIN_WIN.typography.bodySize,
                fontWeight: '500',
                color: SPIN_WIN.colors.goldTransparent,
                textAlign: 'center',
              }}
            >
              Your daily streak
            </Text>

            <StreakTracker currentStreak={currentStreak} spinAvailableToday={spinAvailableToday} />

            <Text
              style={{
                fontSize: SPIN_WIN.typography.bodySize,
                fontWeight: '500',
                color: SPIN_WIN.colors.goldTransparent,
                textAlign: 'center',
              }}
            >
              Complete your 7-day streak to qualify!
            </Text>
          </View>

          <View
            style={{
              height: 1,
              backgroundColor: SPIN_WIN.colors.divider,
            }}
          />

          <View style={{ paddingHorizontal: 20, paddingTop: 20, paddingBottom: 24, gap: 4 }}>
            <Text
              style={{
                fontSize: SPIN_WIN.typography.headingSize,
                fontWeight: '500',
                color: SPIN_WIN.colors.goldTransparent,
                textAlign: 'center',
              }}
            >
              This week&apos;s prize pool
            </Text>

            <Text
              style={{
                fontSize: SPIN_WIN.typography.largePrize,
                fontWeight: '600',
                color: SPIN_WIN.colors.gold,
                textAlign: 'center',
                fontVariant: ['tabular-nums'],
              }}
            >
              {formattedPrize}
            </Text>

            <Text
              style={{
                fontSize: SPIN_WIN.typography.bodySize,
                fontWeight: '500',
                color: SPIN_WIN.colors.goldTransparent,
                textAlign: 'center',
                marginTop: 8,
              }}
            >
              Next Giveaway
            </Text>

            <Text
              style={{
                fontSize: SPIN_WIN.typography.countdownNumber,
                fontWeight: '600',
                color: SPIN_WIN.colors.gold,
                textAlign: 'center',
                fontVariant: ['tabular-nums'],
              }}
            >
              {countdown || '0d 00:00:00'}
            </Text>
          </View>
        </LinearGradient>
      </View>

      <View className="items-center px-6 pb-28">
        <Pressable onPress={onClose} style={{ width: '100%', maxWidth: 388 }}>
          <View
            style={{
              backgroundColor: SPIN_WIN.colors.gold,
              borderRadius: SPIN_WIN.borderRadius.button,
              borderCurve: 'continuous',
              paddingVertical: 15,
              alignItems: 'center',
            }}
          >
            <Text
              style={{
                fontSize: SPIN_WIN.typography.ctaSize,
                fontWeight: SPIN_WIN.typography.ctaWeight,
                color: '#000000',
              }}
            >
              Continue
            </Text>
          </View>
        </Pressable>
      </View>
    </View>
  );
}

function CountdownNumber({ number, onDone }: { number: number; onDone: () => void }) {
  const scale = useSharedValue(0.3);
  const opacity = useSharedValue(0);

  useEffect(() => {
    scale.value = withSequence(
      withTiming(1.2, { duration: 400, easing: ReanimatedEasing.out(ReanimatedEasing.back(1.5)) }),
      withTiming(0.8, { duration: 300 }),
      withTiming(0, { duration: 200 }),
    );
    opacity.value = withSequence(
      withTiming(1, { duration: 300 }),
      withTiming(1, { duration: 400 }),
      withTiming(0, { duration: 200 }),
    );

    const timer = setTimeout(onDone, 900);
    return () => clearTimeout(timer);
  }, [onDone, opacity, scale]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return (
    <Reanimated.View
      style={[
        {
          alignItems: 'center',
          justifyContent: 'center',
        },
        animatedStyle,
      ]}
    >
      <Text
        style={{
          fontSize: 150,
          fontWeight: '700',
          color: SPIN_WIN.colors.gold,
          textShadowColor: SPIN_WIN.colors.goldGlow,
          textShadowOffset: { width: 0, height: 0 },
          textShadowRadius: 30,
        }}
      >
        {number}
      </Text>
    </Reanimated.View>
  );
}

function SpinWinCountdownScreen({
  onClose,
  onComplete,
}: {
  onClose: () => void;
  onComplete: () => void;
}) {
  const [currentNumber, setCurrentNumber] = useState(3);

  const handleDone = () => {
    if (currentNumber > 1) {
      setCurrentNumber(prev => prev - 1);
      return;
    }

    onComplete();
  };

  return (
    <View style={{ flex: 1, backgroundColor: SPIN_WIN.colors.background }}>
      <SpinWinHeader title="Spin & Win" onClose={onClose} />

      <View style={{ alignItems: 'center', marginTop: 40 }}>
        <Text
          style={{
            fontSize: SPIN_WIN.typography.titleSize,
            fontWeight: SPIN_WIN.typography.titleWeight,
            color: SPIN_WIN.colors.textPrimary,
            textAlign: 'center',
            letterSpacing: -3,
            width: 230,
          }}
        >
          And the winner is...
        </Text>
      </View>

      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <View
          style={{
            position: 'absolute',
            width: SPIN_WIN.hero.imageSize,
            height: SPIN_WIN.hero.imageSize,
            borderRadius: SPIN_WIN.hero.imageSize / 2,
            backgroundColor: SPIN_WIN.colors.goldSubtle,
            shadowColor: SPIN_WIN.colors.gold,
            shadowRadius: 80,
            shadowOpacity: 0.4,
            shadowOffset: { width: 0, height: 0 },
          }}
        />
        <CountdownNumber key={currentNumber} number={currentNumber} onDone={handleDone} />
      </View>
    </View>
  );
}

function SpinWinGiveawayScreen({
  onClose,
  onOpenHome,
}: {
  onClose: () => void;
  onOpenHome: () => void;
}) {
  const { data: giveaway } = useCurrentGiveaway();
  const countdown = useGiveawayCountdown(giveaway?.giveawayDate);
  const currentStreak = useSpinWinStore(state => state.currentStreak);
  const spinAvailableToday = useSpinWinStore(state => state.spinAvailableToday);

  const [showCountdown, setShowCountdown] = useState(true);
  const [showConfetti, setShowConfetti] = useState(false);
  const [showAnnouncement, setShowAnnouncement] = useState(false);

  const winnerScale = useSharedValue(0);
  const winnerOpacity = useSharedValue(0);
  const announcementOpacity = useSharedValue(0);

  const winnerName = giveaway?.winnerDisplayName ?? 'Unknown';
  const prizePool = giveaway?.prizePool ?? 0;
  const formattedPrize = `$${prizePool.toLocaleString()}`;

  const handleCountdownComplete = () => {
    setShowCountdown(false);
    setShowConfetti(true);

    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }

    winnerScale.value = withTiming(1, {
      duration: 500,
      easing: ReanimatedEasing.out(ReanimatedEasing.back(1.5)),
    });
    winnerOpacity.value = withTiming(1, { duration: 400 });

    setTimeout(() => {
      setShowAnnouncement(true);
      announcementOpacity.value = withTiming(1, { duration: 500 });
    }, 3000);
  };

  const winnerAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: winnerScale.value }],
    opacity: winnerOpacity.value,
  }));

  const announcementAnimatedStyle = useAnimatedStyle(() => ({
    opacity: announcementOpacity.value,
  }));

  if (showCountdown) {
    return <SpinWinCountdownScreen onClose={onClose} onComplete={handleCountdownComplete} />;
  }

  if (showAnnouncement) {
    return (
      <View style={{ flex: 1, backgroundColor: SPIN_WIN.colors.background }}>
        <SpinWinHeader title="Spin & Win" onClose={onClose} />
        <ConfettiOverlay visible={showConfetti} />

        <Reanimated.View
          style={[
            { flex: 1, alignItems: 'center', justifyContent: 'space-between' },
            announcementAnimatedStyle,
          ]}
        >
          <View style={{ alignItems: 'center', marginTop: 32, paddingHorizontal: 28 }}>
            <Text
              style={{
                fontSize: 24,
                fontWeight: '600',
                color: SPIN_WIN.colors.textPrimary,
                textAlign: 'center',
                width: 318,
              }}
            >
              {winnerName} won this weeks {formattedPrize} prize pool!
            </Text>
          </View>

          <View style={{ alignItems: 'center', paddingHorizontal: 16 }}>
            <LinearGradient
              colors={[SPIN_WIN.gradient.prizePoolColors[0], SPIN_WIN.gradient.prizePoolColors[1]]}
              start={SPIN_WIN.gradient.prizePoolStart}
              end={SPIN_WIN.gradient.prizePoolEnd}
              style={{
                borderRadius: SPIN_WIN.borderRadius.card,
                overflow: 'hidden',
                width: '100%',
                maxWidth: 388,
                alignSelf: 'center',
              }}
            >
              <View style={{ paddingHorizontal: 20, paddingTop: 24, paddingBottom: 20, gap: 12 }}>
                <Text
                  style={{
                    fontSize: SPIN_WIN.typography.bodySize,
                    fontWeight: '500',
                    color: SPIN_WIN.colors.goldTransparent,
                    textAlign: 'center',
                  }}
                >
                  Your daily streak
                </Text>

                <StreakTracker
                  currentStreak={currentStreak}
                  spinAvailableToday={spinAvailableToday}
                />

                <Text
                  style={{
                    fontSize: SPIN_WIN.typography.bodySize,
                    fontWeight: '500',
                    color: SPIN_WIN.colors.goldTransparent,
                    textAlign: 'center',
                  }}
                >
                  Complete your 7-day streak to qualify!
                </Text>
              </View>

              <View
                style={{
                  height: 1,
                  backgroundColor: SPIN_WIN.colors.divider,
                }}
              />

              <View style={{ paddingHorizontal: 20, paddingTop: 20, paddingBottom: 24, gap: 4 }}>
                <Text
                  style={{
                    fontSize: SPIN_WIN.typography.headingSize,
                    fontWeight: '500',
                    color: SPIN_WIN.colors.goldTransparent,
                    textAlign: 'center',
                  }}
                >
                  New week&apos;s prize pool
                </Text>

                <Text
                  style={{
                    fontSize: SPIN_WIN.typography.largePrize,
                    fontWeight: '600',
                    color: SPIN_WIN.colors.gold,
                    textAlign: 'center',
                    fontVariant: ['tabular-nums'],
                  }}
                >
                  {formattedPrize}
                </Text>

                <Text
                  style={{
                    fontSize: SPIN_WIN.typography.bodySize,
                    fontWeight: '500',
                    color: SPIN_WIN.colors.goldTransparent,
                    textAlign: 'center',
                    marginTop: 8,
                  }}
                >
                  Next Giveaway
                </Text>

                <Text
                  style={{
                    fontSize: SPIN_WIN.typography.countdownNumber,
                    fontWeight: '600',
                    color: SPIN_WIN.colors.gold,
                    textAlign: 'center',
                    fontVariant: ['tabular-nums'],
                  }}
                >
                  {countdown || '0D 0H 0M 0S'}
                </Text>
              </View>
            </LinearGradient>
          </View>

          <View
            style={{
              alignItems: 'center',
              paddingHorizontal: 16,
              paddingBottom: 48,
              width: '100%',
            }}
          >
            <Pressable onPress={onOpenHome} style={{ width: '100%', maxWidth: 388 }}>
              <View
                style={{
                  backgroundColor: SPIN_WIN.colors.gold,
                  borderRadius: SPIN_WIN.borderRadius.button,
                  borderCurve: 'continuous',
                  paddingVertical: 16,
                  alignItems: 'center',
                }}
              >
                <Text
                  style={{
                    fontSize: SPIN_WIN.typography.ctaSize,
                    fontWeight: SPIN_WIN.typography.ctaWeight,
                    color: '#000000',
                  }}
                >
                  Spin the wheel
                </Text>
              </View>
            </Pressable>
          </View>
        </Reanimated.View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: SPIN_WIN.colors.background }}>
      <SpinWinHeader title="Spin & Win" onClose={onClose} />
      <ConfettiOverlay visible={showConfetti} />

      <View style={{ alignItems: 'center', marginTop: 40 }}>
        <Text
          style={{
            fontSize: SPIN_WIN.typography.titleSize,
            fontWeight: SPIN_WIN.typography.titleWeight,
            color: SPIN_WIN.colors.textPrimary,
            textAlign: 'center',
            letterSpacing: -3,
            width: 230,
          }}
        >
          And the winner is...
        </Text>
      </View>

      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <View
          style={{
            position: 'absolute',
            width: SPIN_WIN.hero.imageSize,
            height: SPIN_WIN.hero.imageSize,
            borderRadius: SPIN_WIN.hero.imageSize / 2,
            backgroundColor: SPIN_WIN.colors.goldSubtle,
            shadowColor: SPIN_WIN.colors.gold,
            shadowRadius: 80,
            shadowOpacity: 0.4,
            shadowOffset: { width: 0, height: 0 },
          }}
        />

        <Reanimated.View style={[{ alignItems: 'center' }, winnerAnimatedStyle]}>
          <Text
            style={{
              fontSize: 60,
              fontWeight: '600',
              color: SPIN_WIN.colors.textPrimary,
              textAlign: 'center',
            }}
          >
            {winnerName}
          </Text>
        </Reanimated.View>
      </View>

      <Pressable
        onPress={() => {
          setShowAnnouncement(true);
          announcementOpacity.value = withTiming(1, { duration: 500 });
        }}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
      />
    </View>
  );
}

const SpinWinModalProvider = () => {
  const { currentModal, previousModal, resultPoints, setModal, setResultPoints, reset } =
    useSpinWinModalStore(
      useShallow(state => ({
        currentModal: state.currentModal ?? SPIN_WIN_MODAL.CLOSE,
        previousModal: state.previousModal ?? SPIN_WIN_MODAL.CLOSE,
        resultPoints: state.resultPoints,
        setModal: state.setModal,
        setResultPoints: state.setResultPoints,
        reset: state.reset,
      })),
    );

  const isOpen = currentModal.name !== SPIN_WIN_MODAL.CLOSE.name;

  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (!open) {
        reset();
      }
    },
    [reset],
  );

  const handleSpinFinished = useCallback(
    (points: number) => {
      setResultPoints(points);
      setModal(SPIN_WIN_MODAL.OPEN_SUMMARY);
    },
    [setModal, setResultPoints],
  );

  const contentKey = useMemo(() => {
    if (currentModal.name === SPIN_WIN_MODAL.OPEN_RESULT.name) {
      return `${currentModal.name}-${resultPoints ?? 0}`;
    }

    return currentModal.name;
  }, [currentModal.name, resultPoints]);

  const disableScroll = true;

  const content = useMemo(() => {
    switch (currentModal.name) {
      case SPIN_WIN_MODAL.OPEN_HOME.name:
        return (
          <SpinWinHomeScreen
            onClose={reset}
            onSpin={() => {
              if (Platform.OS !== 'web') {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              }
              setModal(SPIN_WIN_MODAL.OPEN_WHEEL);
            }}
          />
        );
      case SPIN_WIN_MODAL.OPEN_WHEEL.name:
        return (
          <SpinWinWheelScreen
            onClose={reset}
            onBack={() => setModal(SPIN_WIN_MODAL.OPEN_HOME)}
            onSpinFinished={handleSpinFinished}
          />
        );
      case SPIN_WIN_MODAL.OPEN_RESULT.name:
        return (
          <SpinWinResultScreen
            points={resultPoints ?? 0}
            onContinue={() => setModal(SPIN_WIN_MODAL.OPEN_SUMMARY)}
          />
        );
      case SPIN_WIN_MODAL.OPEN_SUMMARY.name:
        return (
          <SpinWinSummaryScreen
            onClose={reset}
            onBack={() => setModal(SPIN_WIN_MODAL.OPEN_RESULT)}
          />
        );
      case SPIN_WIN_MODAL.OPEN_GIVEAWAY.name:
        return (
          <SpinWinGiveawayScreen
            onClose={reset}
            onOpenHome={() => setModal(SPIN_WIN_MODAL.OPEN_HOME)}
          />
        );
      default:
        return null;
    }
  }, [currentModal.name, handleSpinFinished, reset, resultPoints, setModal]);

  return (
    <ResponsiveModal
      currentModal={currentModal}
      previousModal={previousModal}
      isOpen={isOpen}
      onOpenChange={handleOpenChange}
      trigger={null}
      title={undefined}
      contentKey={contentKey}
      contentClassName="mt-0 h-screen w-screen max-w-full justify-start rounded-none bg-background p-0"
      containerClassName="h-full gap-0"
      disableScroll={disableScroll}
      hideHeader
    >
      {content}
    </ResponsiveModal>
  );
};

export default SpinWinModalProvider;
