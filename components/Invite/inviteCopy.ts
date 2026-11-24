import {
  perkDay,
  readInvitePerk,
  sepaPerkPhrase,
  sepaPerkSentence,
} from '@/lib/referral/invitePerk';
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

/**
 * What the page says, from the lookup: a KOL's invite perk, v4's card bonus,
 * the cashback offer, or a plain welcome.
 */
export const inviteCopy = (lookup: ReferralInviteLookup | undefined): InviteCopy => {
  const inviter = lookup?.valid ? lookup.referrer.username : null;
  const perk = lookup?.valid ? readInvitePerk(lookup.perk) : null;

  // A KOL's perk code leads with the perk; the referral offer still applies
  // and is mentioned after it.
  if (lookup?.valid && perk) {
    const title: InviteTitlePart[] =
      perk.tierDiscountPct > 0
        ? [
            { text: 'Get ' },
            { text: `${perk.tierDiscountPct}% off`, accent: true },
            { text: ' your first\nyear of Prime or Ultra' },
          ]
        : [
            { text: 'Free ' },
            { text: 'SEPA deposits', accent: true },
            {
              text: `\nfor your first ${perk.sepaFreeMonths === 1 ? 'month' : `${perk.sepaFreeMonths} months`}`,
            },
          ];
    const sentences: string[] = [];
    if (perk.tierDiscountPct > 0 && perk.sepaFreeMonths > 0) {
      sentences.push(`Plus ${sepaPerkPhrase(perk)}.`);
    } else if (perk.tierDiscountPct > 0) {
      sentences.push('The discount applies to your first year of membership.');
    } else {
      sentences.push(`${sepaPerkSentence(perk)}.`);
    }
    if (lookup.offer) {
      sentences.push(
        `And spend ${formatUsdWhole(lookup.offer.spendTargetUsd)} in your first ${lookup.offer.windowDays} days for a ${formatUsdWhole(lookup.offer.friendCreditUsd)} card bonus.`,
      );
    } else if (lookup.legacyOffer) {
      sentences.push(
        `And spend ${formatUsdWhole(lookup.legacyOffer.spendTargetUsd)} in your first ${lookup.legacyOffer.windowDays} days to get ${formatUsdWhole(lookup.legacyOffer.friendRewardUsd)} in ${lookup.legacyOffer.payoutToken}.`,
      );
    }
    const steps = ['Create your account'];
    if (perk.sepaFreeMonths > 0) steps.push('Deposit euros by SEPA with no fee');
    if (perk.tierDiscountPct > 0) {
      steps.push(`Upgrade to Prime or Ultra for ${perk.tierDiscountPct}% off`);
    }
    if (steps.length < 3) steps.push('Get your free card');
    const lastDay = perkDay(perk.endsAt);
    return {
      inviter,
      title,
      subtitle: sentences.join(' '),
      steps,
      footnote: lastDay ? `For new accounts created by ${lastDay}.` : null,
    };
  }

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

/**
 * The header's link: "Log in" for a visitor, a way back to the wallet for someone who is
 * already signed in and has nothing to log in to.
 */
export const inviteHeaderLabel = (isSignedIn: boolean): string =>
  isSignedIn ? 'Go to wallet' : 'Log in';

/** The pill's avatar letter: the inviter's first character, upper-cased. */
export const inviterInitial = (name: string): string =>
  Array.from(name.trim())[0]?.toUpperCase() ?? '';
