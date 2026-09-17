import { Pressable, TextStyle, View } from 'react-native';
import { router } from 'expo-router';

import { HOME_BANNER_RADIUS } from '@/components/Home/NewHome/homeBannerStyle';
import TierStar from '@/components/Rewards/NewRewards/TierHero/TierStar';
import { Text } from '@/components/ui/text';
import { path } from '@/constants/path';
import { getTierDisplayName } from '@/constants/rewards';
import { TierTrial } from '@/lib/types';

import { durationLabel, trialDaysRemaining } from './tierTrialCopy';

/** Figma: Mona Sans / Bold 700 / 18px, matching the neighbouring CTA banners. */
const TITLE_STYLE: TextStyle = {
  fontFamily: 'MonaSans_700Bold',
  fontSize: 18,
  lineHeight: 18,
};
const CTA_STYLE: TextStyle = {
  fontFamily: 'MonaSans_600SemiBold',
  fontSize: 14,
  lineHeight: 18,
};

/** The star sits small here — the popup is where it is the hero. */
const BANNER_STAR_SIZE = 96;

interface TierTrialBannerProps {
  /** The trial to talk about: one waiting to be started, or one running. */
  trial: TierTrial;
  /** Opens the offer popup. Only passed for a trial waiting to be started. */
  onActivate?: () => void;
  className?: string;
}

/**
 * The wallet-screen card that carries a tier trial (Figma 25479:2479).
 *
 * Two states, one card. A trial waiting to be started is an offer and its CTA
 * opens the popup that explains and activates it; a trial already running is
 * news, and its CTA goes to the tier screen. Neither one activates anything by
 * itself — the trial's clock is the user's to start, so tapping through to the
 * popup is deliberately a step.
 *
 * There is no ✕, unlike the card-funnel banners it sits with. The offer stays
 * claimable however many times the user says "Maybe later", and this card is
 * the only way back to it — a dismissal here would leave a live gift with
 * nothing in the app pointing at it.
 *
 * Drawn to the same radius and type as those banners, so the column reads as
 * one stack rather than as this card visiting.
 */
const TierTrialBanner = ({ trial, onActivate, className }: TierTrialBannerProps) => {
  const tierName = getTierDisplayName(trial.tier);
  const isRunning = trial.status === 'active';
  const daysLeft = trialDaysRemaining(trial);

  const { title, description, cta } = isRunning
    ? {
        title: `You're on ${tierName}`,
        description: `Enjoy your extra rewards for the next ${durationLabel(daysLeft)}.`,
        cta: 'Explore benefits →',
      }
    : {
        title: "You've received a gift",
        description: `${durationLabel(trial.durationDays)} of ${tierName}, free. Activate to start.`,
        cta: `Activate ${trial.source === 'promotion' ? tierName : 'gift'} →`,
      };

  const onPress = () => {
    if (isRunning) {
      router.push(path.REWARDS_BENEFITS);
      return;
    }
    onActivate?.();
  };

  return (
    <View className={className}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={title}
        onPress={onPress}
        style={{ borderRadius: HOME_BANNER_RADIUS }}
        className="overflow-hidden bg-card transition-opacity active:opacity-90"
      >
        <View className="flex-row items-center justify-between p-5">
          <View className="flex-1 gap-1 pr-3">
            <Text className="text-foreground" style={TITLE_STYLE}>
              {title}
            </Text>
            {/* white/70 to match the CTA banners above it, not
                `text-muted-foreground`, which is a good deal darker. */}
            <Text className="text-sm leading-4 text-white/70">{description}</Text>
            <Text className="mt-3 text-brand" style={CTA_STYLE}>
              {cta}
            </Text>
          </View>
          <TierStar tier={trial.tier} size={BANNER_STAR_SIZE} />
        </View>
      </Pressable>
    </View>
  );
};

export default TierTrialBanner;
