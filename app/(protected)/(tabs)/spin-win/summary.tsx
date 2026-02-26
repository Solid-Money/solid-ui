import { Pressable, TouchableOpacity, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import StreakTracker from '@/components/SpinAndWin/StreakTracker';
import { Text } from '@/components/ui/text';
import { path } from '@/constants/path';
import { SPIN_WIN } from '@/constants/spinWinDesign';
import { useCurrentGiveaway, useGiveawayCountdown } from '@/hooks/useGiveaway';
import { useSpinWinStore } from '@/store/useSpinWinStore';

export default function SummaryScreen() {
  const currentStreak = useSpinWinStore(state => state.currentStreak);
  const spinAvailableToday = useSpinWinStore(state => state.spinAvailableToday);

  const { data: giveaway } = useCurrentGiveaway();
  const countdown = useGiveawayCountdown(giveaway?.giveawayDate);

  const prizePool = giveaway?.prizePool ?? 0;
  const formattedPrize = `$${prizePool.toLocaleString()}`;

  return (
    <View style={{ flex: 1, backgroundColor: SPIN_WIN.colors.background }}>
      {/* Custom header matching wheel.tsx */}
      <Stack.Screen
        options={{
          title: 'Spin & Win',
          headerTitleStyle: {
            color: SPIN_WIN.colors.textPrimary,
            fontSize: 20,
            fontWeight: '600',
          },
          headerLeft: () => (
            <TouchableOpacity
              onPress={() => router.back()}
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
          ),
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
        }}
      />

      {/* Content area */}
      <View className="flex-1 items-center justify-center px-4">
        {/* Combined Gradient Card */}
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
            {/* "Your daily streak" label */}
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

            {/* Streak badges */}
            <StreakTracker currentStreak={currentStreak} spinAvailableToday={spinAvailableToday} />

            {/* Qualification message */}
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
            {/* "This week's prize pool" label */}
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

            {/* Prize amount */}
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

            {/* "Next Giveaway" label */}
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

            {/* Countdown */}
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

      {/* Continue button */}
      <View className="items-center px-6 pb-28">
        <Pressable onPress={() => router.dismissAll()} style={{ width: 388 }}>
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
