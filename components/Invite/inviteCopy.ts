import { formatUsdWhole } from '@/lib/referral/referralV4';

import type { ReferralInviteLookup } from '@/lib/types';

/** One run of the headline. The amount is the `accent` run, set in brand green. */
export interface InviteTitlePart {
  text: string;
  accent?: boolean;
}

export interface InviteCopy {
  /** Who invited the friend, for the "invited you" pill; null when we don't know who. */
  inviter: string | null;
  title: InviteTitlePart[];
  subtitle: string;
  steps: string[];
  footnote: string | null;
}

/** What the page says, from the lookup: v4's card bonus, the cashback offer, or a plain welcome. */
export const inviteCopy = (lookup: ReferralInviteLookup | undefined): InviteCopy => {
  const inviter = lookup?.valid ? lookup.referrer.username : null;

  if (lookup?.valid && lookup.offer) {
    const { friendCreditUsd, spendTargetUsd, merchantTarget, windowDays } = lookup.offer;
    return {
      inviter,
      title: [
        { text: 'Get ' },
        { text: formatUsdWhole(friendCreditUsd), accent: true },
        { text: ' to spend\nwith your card' },
      ],
      subtitle: `Spend ${formatUsdWhole(spendTargetUsd)} in your first ${windowDays} days and your next ${formatUsdWhole(
        friendCreditUsd,
      )} of purchases are on us.`,
      steps: [
        'Create your account',
        'Get your free card',
        `Spend ${formatUsdWhole(spendTargetUsd)} at ${merchantTarget} or more shops`,
      ],
      footnote: 'Card bonus can only be spent with your Solid card.',
    };
  }

  if (lookup?.valid && lookup.legacyOffer) {
    const { friendRewardUsd, spendTargetUsd, merchantTarget, windowDays, payoutToken } =
      lookup.legacyOffer;
    return {
      inviter,
      title: [
        { text: 'Get ' },
        { text: formatUsdWhole(friendRewardUsd), accent: true },
        { text: ' when you\nspend with your card' },
      ],
      subtitle: `Spend ${formatUsdWhole(spendTargetUsd)} in your first ${windowDays} days and get ${formatUsdWhole(
        friendRewardUsd,
      )} in ${payoutToken}.`,
      steps: [
        'Create your account',
        'Get your free card',
        `Spend ${formatUsdWhole(spendTargetUsd)} at ${merchantTarget} or more shops`,
      ],
      footnote: null,
    };
  }

  return {
    inviter,
    title: [{ text: 'Welcome to Solid' }],
    subtitle: 'Save, spend and earn with one account and your Solid card.',
    steps: ['Create your account', 'Get your free card', 'Spend and earn cashback'],
    footnote: null,
  };
};

/** The pill's avatar letter: the inviter's first character, upper-cased. */
export const inviterInitial = (name: string): string =>
  Array.from(name.trim())[0]?.toUpperCase() ?? '';
