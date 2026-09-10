import { getTierDisplayName } from '@/lib/tierNames';
import { RewardsTier, RewardsUserData, TierBenefits, TierTrial } from '@/lib/types';

import type { TierPopupStat } from './TierPopup';

/**
 * The three headline benefits a tier grants, as the popups quote them.
 *
 * Read from the tier-benefits endpoint rather than from the user's own rewards
 * data, because a gift is usually a tier the user does not hold yet: their
 * payload reports Core's zeroes, and quoting those under "Welcome to Prime"
 * would advertise nothing. A rate the backend has not sent drops its column
 * rather than rendering "undefined%".
 */
export const tierPopupStats = (benefits?: TierBenefits): TierPopupStat[] => {
  if (!benefits) return [];

  const stats: TierPopupStat[] = [];

  if (benefits.cardCashback?.title) {
    stats.push({ value: benefits.cardCashback.title, label: 'Cashback' });
  }

  if (benefits.subscriptionDiscountRate) {
    stats.push({
      value: `${benefits.subscriptionDiscountRate}%`,
      label: 'Subscriptions',
    });
  }

  if (benefits.yieldBoostPercentage) {
    stats.push({
      value: `+${benefits.yieldBoostPercentage}%`,
      label: 'Yield boost',
    });
  }

  return stats;
};

/** The tier's benefits from the tier-benefits list, when it has landed. */
export const benefitsForTier = (
  benefits: TierBenefits[] | undefined,
  tier: RewardsTier,
): TierBenefits | undefined => benefits?.find(entry => entry.tier === tier);

/** "30 days" / "1 day" — durations appear in four different sentences. */
export const durationLabel = (days: number): string => `${days} ${days === 1 ? 'day' : 'days'}`;

/**
 * What is left of a running trial, as the countdown pill shows it.
 *
 * Built from the backend's `hoursRemaining` rather than from `expiresAt`, so
 * the pill can never round to a day the expiry the backend enforces disagrees
 * with. Below an hour it says so rather than showing "0h".
 */
export const trialRemainingLabel = (trial: TierTrial): string => {
  const hours = Math.max(0, Math.floor(trial.hoursRemaining ?? 0));
  const days = Math.floor(hours / 24);
  const restHours = hours % 24;

  if (days > 0) return `${days}d ${restHours}h left`;
  if (hours > 0) return `${hours}h left`;
  return 'Ending soon';
};

/** Whole days left, rounded up — for the sentences that talk in days. */
export const trialDaysRemaining = (trial: TierTrial): number =>
  Math.max(0, Math.ceil((trial.hoursRemaining ?? 0) / 24));

interface TrialOfferCopy {
  eyebrow: string;
  title: string;
  body: string;
  note: string;
  primaryLabel: string;
  secondaryLabel: string;
  footnote: string;
}

/**
 * The opt-in popup's words for a trial waiting to be started.
 *
 * Two sources, two stories: an admin gift is a present and says so, while the
 * welcome offer earned by funding is told as a qualification (Figma 25481:2356).
 * Both end the same way, because the mechanic is the same — the clock starts on
 * activation, and nothing is charged when it stops.
 */
export const trialOfferCopy = (trial: TierTrial): TrialOfferCopy => {
  const tierName = getTierDisplayName(trial.tier);
  const duration = durationLabel(trial.durationDays);
  const shared = {
    note: 'Your trial starts when you activate.',
    secondaryLabel: 'Maybe later',
    footnote: `No charge. After ${duration}, you return to your otherwise-earned tier.`,
  };

  if (trial.source === 'promotion') {
    return {
      ...shared,
      eyebrow: 'Welcome offer',
      title: `You've qualified for ${tierName}`,
      body: `Your deposit landed in time. Activate your free ${duration} of ${tierName}.`,
      primaryLabel: `Activate ${tierName}`,
    };
  }

  return {
    ...shared,
    eyebrow: 'A gift for you',
    title: "You've received a gift",
    // The admin's own message when they wrote one: it is the reason the gift
    // exists, and it says more than any copy here can.
    body:
      trial.giftMessage?.trim() ||
      `${duration} of ${tierName}, on us. Activate to start your trial.`,
    primaryLabel: 'Activate gift',
  };
};

interface UpgradeCelebrationCopy {
  eyebrow: string;
  title: string;
  body: string;
  note?: string;
}

/**
 * The celebration's words for a tier the user now holds.
 *
 * The body names how they got there, because the three routes are genuinely
 * different news: a trial someone handed them, a points milestone they climbed
 * to, and a FUSE balance that unlocked it outright (Figma 25480:2355). A trial
 * also gets the line that says how long it runs — the one thing this upgrade
 * has that the other two do not.
 */
export const upgradeCelebrationCopy = (data: RewardsUserData): UpgradeCelebrationCopy => {
  const tierName = getTierDisplayName(data.currentTier);
  const trial = data.activeTierTrial;
  const shared = { eyebrow: 'Tier upgraded', title: `Welcome to ${tierName}` };

  if (trial && trial.tier === data.currentTier) {
    return {
      ...shared,
      body: 'Your upgrade is active. Enjoy more rewards every time you spend.',
      note: `Your ${durationLabel(trial.durationDays)} of ${tierName} start now.`,
    };
  }

  if (data.fuseSkipLine?.enabled && data.fuseSkipLine.unlockedTier === data.currentTier) {
    return {
      ...shared,
      body: `Your confirmed FUSE Savings balance has unlocked ${tierName}.`,
      note: 'Keep that balance in Savings to hold this tier.',
    };
  }

  return {
    ...shared,
    body:
      data.currentTier === RewardsTier.ULTRA
        ? "You've reached a new tier. Enjoy your highest rewards yet."
        : `You reached the ${tierName} points milestone. Your new benefits are now active.`,
  };
};
