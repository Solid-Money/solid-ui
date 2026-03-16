import { Pressable, View } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';

import StreakTracker from '@/components/SpinAndWin/StreakTracker';
import { Text } from '@/components/ui/text';
import { SPIN_WIN } from '@/constants/spinWinDesign';
import { useNextSpinCountdown } from '@/hooks/useNextSpinCountdown';

interface SpinWinCardProps {
  currentStreak: number;
  spinAvailable: boolean;
  lastSpinDate: string | null;
  prizePool?: number;
  countdown?: string;
  giveawayDate?: string;
  onPress: () => void;
}

const piggyBankImage = require('@/assets/images/spin-win/piggy-bank-3d.png');

export default function SpinWinCard({
  currentStreak,
  spinAvailable,
  lastSpinDate,
  prizePool,
  countdown,
  onPress,
}: SpinWinCardProps) {
  const hasSpunBefore = lastSpinDate !== null;
  const nextSpinCountdown = useNextSpinCountdown(spinAvailable, lastSpinDate);
  const spinCtaLabel = spinAvailable ? 'Spin the wheel' : `Next spin in ${nextSpinCountdown}`;

  if (!hasSpunBefore) {
    return (
      <Pressable onPress={onPress}>
        <LinearGradient
          colors={[SPIN_WIN.gradient.prizePoolColors[0], SPIN_WIN.gradient.prizePoolColors[1]]}
          start={{ x: 0.3, y: 0 }}
          end={{ x: 0.7, y: 1 }}
          style={{
            borderRadius: SPIN_WIN.borderRadius.card,
            borderCurve: 'continuous',
            padding: 20,
            height: 152,
            overflow: 'hidden',
            flexDirection: 'row',
            alignItems: 'center',
          }}
        >
          <View style={{ flex: 1 }}>
            <Text
              style={{
                fontSize: 20,
                fontWeight: '600',
                color: SPIN_WIN.colors.textPrimary,
                letterSpacing: -1,
              }}
            >
              Spin & Win
            </Text>
            <Text
              style={{
                fontSize: 16,
                color: 'rgba(255, 255, 255, 0.7)',
                marginTop: 8,
              }}
            >
              Your daily spin is ready!
            </Text>
            <View
              style={{
                marginTop: 12,
                backgroundColor: SPIN_WIN.colors.goldSubtle,
                borderRadius: SPIN_WIN.borderRadius.badge,
                borderCurve: 'continuous',
                paddingVertical: 12,
                width: 195,
                alignItems: 'center',
              }}
            >
              <Text
                style={{
                  fontSize: 16,
                  fontWeight: '700',
                  color: SPIN_WIN.colors.textPrimary,
                }}
              >
                Spin the wheel
              </Text>
            </View>
          </View>

          <Image
            source={piggyBankImage}
            style={{ width: 200, height: 200, marginRight: -40 }}
            contentFit="contain"
          />
        </LinearGradient>
      </Pressable>
    );
  }

  return (
    <Pressable onPress={onPress}>
      <LinearGradient
        colors={[SPIN_WIN.gradient.prizePoolColors[0], SPIN_WIN.gradient.prizePoolColors[1]]}
        start={{ x: 0.3, y: 0 }}
        end={{ x: 0.7, y: 1 }}
        style={{
          borderRadius: SPIN_WIN.borderRadius.card,
          borderCurve: 'continuous',
          padding: 20,
          overflow: 'hidden',
        }}
      >
        {/* Spin & Win header */}
        <Text
          style={{
            fontSize: 20,
            fontWeight: '600',
            color: SPIN_WIN.colors.textPrimary,
            letterSpacing: -1,
          }}
        >
          Spin & Win
        </Text>
        <Text
          style={{
            fontSize: 16,
            color: 'rgba(255, 255, 255, 0.7)',
            marginTop: 4,
          }}
        >
          Your daily spin is ready!
        </Text>

        {/* Day streak tracker */}
        <View style={{ marginTop: 16 }}>
          <StreakTracker currentStreak={currentStreak} spinAvailableToday={spinAvailable} />
        </View>

        {/* Spin button */}
        <View
          style={{
            marginTop: 16,
            backgroundColor: SPIN_WIN.colors.gold,
            borderRadius: SPIN_WIN.borderRadius.badge,
            borderCurve: 'continuous',
            paddingVertical: 10,
            alignItems: 'center',
          }}
        >
          <Text
            style={{
              fontSize: 16,
              fontWeight: '700',
              color: '#000000',
            }}
          >
            {spinCtaLabel}
          </Text>
        </View>

        {/* Divider */}
        <View
          style={{
            height: 1,
            backgroundColor: SPIN_WIN.colors.divider,
            marginVertical: 20,
            marginHorizontal: -20,
          }}
        />

        {/* Prize Pool section */}
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ flex: 1 }}>
            <Text
              style={{
                fontSize: 16,
                fontWeight: '500',
                color: 'rgba(255, 209, 81, 0.7)',
              }}
            >
              This week&apos;s prize pool
            </Text>
            <Text
              style={{
                fontSize: 40,
                fontWeight: '600',
                color: SPIN_WIN.colors.gold,
                fontVariant: ['tabular-nums'],
                marginTop: 4,
                marginBottom: 6,
              }}
            >
              {`$${(prizePool || 0).toLocaleString()}`}
            </Text>
            <Text
              style={{
                fontSize: 16,
                fontWeight: '500',
                color: 'rgba(255, 209, 81, 0.7)',
                marginTop: 4,
                marginBottom: 4,
              }}
            >
              Next Giveaway
            </Text>
            <Text
              style={{
                fontSize: 20,
                fontWeight: '600',
                color: SPIN_WIN.colors.gold,
                fontVariant: ['tabular-nums'],
              }}
            >
              {countdown || '0D 0H 0M 0S'}
            </Text>
          </View>

          <View style={{ flex: 1, alignItems: 'flex-end', width: 170, height: 180 }}>
            <Image
              source={piggyBankImage}
              style={{ width: 200, height: 200, marginRight: -40 }}
              contentFit="cover"
            />
          </View>
        </View>
      </LinearGradient>
    </Pressable>
  );
}
