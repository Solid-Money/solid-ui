import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { Text } from '@/components/ui/text';
import { SPIN_WIN } from '@/constants/spinWinDesign';

interface StreakTrackerProps {
  currentStreak: number;
  spinAvailableToday: boolean;
}

function PulsingBadge({ dayNumber }: { dayNumber: number }) {
  const opacity = useSharedValue(0.5);

  useEffect(() => {
    opacity.value = withRepeat(withTiming(1, { duration: 800 }), -1, true);
  }, [opacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    borderColor: `rgba(255, 209, 81, ${opacity.value})`,
  }));

  return (
    <Animated.View
      style={[
        {
          width: SPIN_WIN.badge.width,
          height: SPIN_WIN.badge.height,
          borderRadius: SPIN_WIN.borderRadius.badge,
          backgroundColor: 'transparent',
          borderWidth: 1,
          alignItems: 'center',
          justifyContent: 'center',
        },
        animatedStyle,
      ]}
    >
      <Text
        style={{
          fontSize: SPIN_WIN.typography.badgeNumber,
          fontWeight: '700',
          color: SPIN_WIN.colors.gold,
        }}
      >
        {dayNumber}
      </Text>
    </Animated.View>
  );
}

export default function StreakTracker({ currentStreak, spinAvailableToday }: StreakTrackerProps) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
      {Array.from({ length: 7 }, (_, i) => {
        const dayNumber = i + 1;
        const isCompleted = i < currentStreak;
        const isNextDay = i === currentStreak;
        const isPulsing = isNextDay && spinAvailableToday;

        if (isPulsing) {
          return <PulsingBadge key={dayNumber} dayNumber={dayNumber} />;
        }

        return (
          <View
            key={dayNumber}
            style={{
              width: SPIN_WIN.badge.width,
              height: SPIN_WIN.badge.height,
              borderRadius: SPIN_WIN.borderRadius.badge,
              backgroundColor: isCompleted ? SPIN_WIN.colors.completedBadgeBg : 'transparent',
              borderWidth: isCompleted ? 0 : 1,
              borderColor: isCompleted ? undefined : SPIN_WIN.colors.incompleteBadgeBorder,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text
              style={{
                fontSize: SPIN_WIN.typography.badgeNumber,
                fontWeight: '700',
                color: isCompleted ? SPIN_WIN.colors.completedBadgeText : SPIN_WIN.colors.gold,
              }}
            >
              {dayNumber}
            </Text>
          </View>
        );
      })}
    </View>
  );
}
