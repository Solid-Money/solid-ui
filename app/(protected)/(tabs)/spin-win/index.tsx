import { Platform, Pressable, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { router } from 'expo-router';

import { FAQ } from '@/components/FAQ';
import PageLayout from '@/components/PageLayout';
import PrizePoolCard from '@/components/SpinAndWin/PrizePoolCard';
import StreakTracker from '@/components/SpinAndWin/StreakTracker';
import { Text } from '@/components/ui/text';
import { path } from '@/constants/path';
import { SPIN_WIN } from '@/constants/spinWinDesign';
import { useCurrentGiveaway, useGiveawayCountdown, useGiveawayWinners } from '@/hooks/useGiveaway';
import { useSpinStatus } from '@/hooks/useSpinWin';

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
];

export default function SpinWinIndex() {
  const { data: spinStatus, isLoading: isStatusLoading } = useSpinStatus();
  const { data: giveaway } = useCurrentGiveaway();
  const { data: winners } = useGiveawayWinners();
  const countdown = useGiveawayCountdown(giveaway?.giveawayDate);

  const isLoading = isStatusLoading;

  // Gate: native-only and allowlist check
  if (Platform.OS === 'web' || (!isStatusLoading && spinStatus?.isAllowed === false)) {
    router.replace('/');
    return null;
  }

  const handleSpin = () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    router.push(path.SPIN_WIN_WHEEL);
  };

  const canSpin = spinStatus?.spinAvailableToday && spinStatus?.isEligible;

  return (
    <PageLayout isLoading={isLoading}>
      <View className="mx-auto w-full max-w-7xl px-4 pb-24 pt-6" style={{ gap: 24 }}>
        {/* Hero Section */}
        <View style={{ alignItems: 'center' }}>
          {/* Gold glow circle behind piggy bank */}
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

          {/* Title */}
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

          {/* Subtitle */}
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

        {/* Daily Streak Section */}
        <View style={{ gap: 12 }}>
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
          <StreakTracker
            currentStreak={spinStatus?.currentStreak ?? 0}
            spinAvailableToday={spinStatus?.spinAvailableToday ?? false}
          />

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

        {/* Spin CTA */}
        <Pressable onPress={handleSpin} disabled={!canSpin}>
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

        {/* Prize Pool Card */}
        {giveaway && (
          <PrizePoolCard
            prizePool={giveaway.prizePool}
            countdown={countdown}
            qualifiedCount={giveaway.qualifiedCount}
            status={giveaway.status}
            winners={winners}
          />
        )}

        {/* FAQ */}
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
    </PageLayout>
  );
}
