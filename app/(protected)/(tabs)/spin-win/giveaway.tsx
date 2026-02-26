import { useState } from 'react';
import { Platform, Pressable, TouchableOpacity, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { router, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import ConfettiOverlay from '@/components/SpinAndWin/ConfettiOverlay';
import CountdownReveal from '@/components/SpinAndWin/CountdownReveal';
import StreakTracker from '@/components/SpinAndWin/StreakTracker';
import { Text } from '@/components/ui/text';
import { path } from '@/constants/path';
import { SPIN_WIN } from '@/constants/spinWinDesign';
import { useCurrentGiveaway, useGiveawayCountdown } from '@/hooks/useGiveaway';
import { useSpinWinStore } from '@/store/useSpinWinStore';

export default function GiveawayScreen() {
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

    // Animate winner name
    winnerScale.value = withTiming(1, {
      duration: 500,
      easing: Easing.out(Easing.back(1.5)),
    });
    winnerOpacity.value = withTiming(1, { duration: 400 });

    // Transition to announcement phase after 3 seconds
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
    return <CountdownReveal onComplete={handleCountdownComplete} />;
  }

  // Header options shared by both reveal and announcement phases
  const headerOptions = {
    title: 'Spin & Win',
    headerTitleStyle: {
      color: SPIN_WIN.colors.textPrimary,
      fontSize: 20,
      fontWeight: '600' as const,
    },
    headerLeft: () => null,
    headerRight: () => (
      <TouchableOpacity
        onPress={() => router.navigate(path.SPIN_WIN as never)}
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
    ),
  };

  // Winner Announcement Phase (after reveal settles)
  if (showAnnouncement) {
    return (
      <View style={{ flex: 1, backgroundColor: SPIN_WIN.colors.background }}>
        <Stack.Screen options={headerOptions} />
        <ConfettiOverlay visible={showConfetti} />

        <Animated.View
          style={[
            { flex: 1, alignItems: 'center', justifyContent: 'space-between' },
            announcementAnimatedStyle,
          ]}
        >
          {/* Top area: announcement text */}
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

          {/* Combined Gradient Card */}
          <View style={{ alignItems: 'center', paddingHorizontal: 16 }}>
            <LinearGradient
              colors={[SPIN_WIN.gradient.prizePoolColors[0], SPIN_WIN.gradient.prizePoolColors[1]]}
              start={SPIN_WIN.gradient.prizePoolStart}
              end={SPIN_WIN.gradient.prizePoolEnd}
              style={{
                borderRadius: SPIN_WIN.borderRadius.card,
                overflow: 'hidden',
                width: 388,
                alignSelf: 'center',
              }}
            >
              {/* Top section: Streak */}
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

              {/* Gold divider */}
              <View
                style={{
                  height: 1,
                  backgroundColor: SPIN_WIN.colors.divider,
                }}
              />

              {/* Bottom section: Prize Pool */}
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

          {/* CTA Button */}
          <View
            style={{
              alignItems: 'center',
              paddingHorizontal: 16,
              paddingBottom: 48,
              width: '100%',
            }}
          >
            <Pressable onPress={() => router.dismissAll()} style={{ width: 388 }}>
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
        </Animated.View>
      </View>
    );
  }

  // Winner Reveal Phase (immediately after countdown)
  return (
    <View style={{ flex: 1, backgroundColor: SPIN_WIN.colors.background }}>
      <Stack.Screen options={headerOptions} />
      <ConfettiOverlay visible={showConfetti} />

      {/* "And the winner is..." text */}
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

      {/* Winner name with gold glow */}
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        {/* Gold glow circle behind the winner name */}
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

        <Animated.View style={[{ alignItems: 'center' }, winnerAnimatedStyle]}>
          {/* Winner name */}
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
        </Animated.View>
      </View>

      {/* Tap to continue hint */}
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
