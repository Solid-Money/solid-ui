import { formatTierCashbackRate } from '@/lib/tierCashback';
import { TIER_YIELD_BOOST_RATES } from '@/lib/tierYieldBoost';
import { RewardsTier, type TierBenefits, type TierFees, type TierOffer } from '@/lib/types';

import {
  type CashbackCategory,
  categoryCashbackPresentation,
  formatCashbackRate,
} from './categoryCashback';

export const TIER_LABELS: Record<RewardsTier, string> = {
  [RewardsTier.CORE]: 'Core',
  [RewardsTier.PRIME]: 'Prime',
  [RewardsTier.ULTRA]: 'Ultra',
};

export const TIER_PRESENTATION = {
  [RewardsTier.CORE]: {
    headline: 'The Solid\nFoundation',
    accent: '#94F27F',
    subscriptionRate: null,
    rideRate: null,
    airlineRate: null,
    stats: [
      { value: formatTierCashbackRate(RewardsTier.CORE), label: 'Cashback' },
      { value: '$0', label: 'Card cost*' },
    ],
    perks: [
      { icon: 'card', title: 'Free virtual card', description: 'Issued instantly' },
      { icon: 'rocket', title: 'Set up in minutes', description: 'Under 5 minutes' },
      { icon: 'globe', title: 'Spend globally', description: 'Card accepted in 180+ countries' },
    ],
  },
  [RewardsTier.PRIME]: {
    headline: 'Elevated Daily\nRewards',
    accent: '#FFFFFF',
    subscriptionRate: '10%',
    rideRate: '8%',
    airlineRate: null,
    stats: [
      { value: formatTierCashbackRate(RewardsTier.PRIME), label: 'Cashback' },
      { value: '+2%', label: 'Yield boost' },
      { value: '10%', label: 'Subscriptions' },
    ],
    perks: [
      { icon: 'yield', title: 'Yield boost', description: '+2% APY on up to $10K in savings' },
      {
        icon: 'subscription',
        title: 'Subscription & ride rewards',
        description: '10% on subscriptions, 8% on rides',
      },
      { icon: 'cap', title: 'Higher cashback caps', description: 'Up to $100 cashback a month' },
    ],
  },
  [RewardsTier.ULTRA]: {
    headline: 'Next-Level\nSpending Power',
    accent: '#EFE5A9',
    subscriptionRate: '20%',
    rideRate: '10%',
    airlineRate: '10%',
    stats: [
      { value: formatTierCashbackRate(RewardsTier.ULTRA), label: 'Cashback' },
      { value: '+3%', label: 'Yield boost' },
      { value: '20%', label: 'Subscriptions' },
    ],
    perks: [
      { icon: 'yield', title: 'Yield boost', description: '+3% APY on up to $25K in savings' },
      {
        icon: 'subscription',
        title: 'Subscription & ride rewards',
        description: '20% on subscriptions, 10% on rides',
      },
      { icon: 'airline', title: 'Airline rewards', description: '10% back on 12 global airlines' },
    ],
  },
} as const;

/** Which glyph a perk row draws, so the list can be filtered without the icons sliding. */
export type PerkIconName =
  | 'card'
  | 'rocket'
  | 'globe'
  | 'yield'
  | 'subscription'
  | 'cap'
  | 'airline';

export interface TierPresentationContent {
  headline: string;
  accent: string;
  subscriptionRate: string | null;
  /** Null when this tier earns nothing on rides, or an admin has paused them. */
  rideRate: string | null;
  /** Null when this tier earns nothing on airlines, or an admin has paused them. */
  airlineRate: string | null;
  /**
   * The categories the cashback panel draws, as the API reports them — its
   * list, its labels, its rates, in its order.
   *
   * Resolved here rather than in the panel so one call decides what this tier's
   * screen says about categories: the rate on each row, the ride and airline
   * figures in the perk copy, and whether a perk is advertised at all. A
   * category an admin has paused is absent; one this tier simply does not earn
   * on is present at 0, which is the locked row that sells the upgrade.
   */
  subscriptionCategories: CashbackCategory[];
  stats: { value: string; label: string }[];
  perks: { icon: PerkIconName; title: string; description: string }[];
}

const balanceCapLabel = (amount: number) =>
  amount >= 1000 && amount % 1000 === 0
    ? `$${amount / 1000}K`
    : `$${amount.toLocaleString('en-US')}`;

const isBenefitNumber = (value: number | undefined): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0;

/** Live numerical benefits win, including zero; older APIs keep the design fallback. */
export function tierPresentationContent(
  tier: RewardsTier,
  live?: TierBenefits,
): TierPresentationContent {
  const fallback = TIER_PRESENTATION[tier];
  const hasSubscriptionRate = isBenefitNumber(live?.subscriptionDiscountRate);
  const subscriptionPercentage = hasSubscriptionRate
    ? live!.subscriptionDiscountRate!
    : tier === RewardsTier.PRIME
      ? 10
      : tier === RewardsTier.ULTRA
        ? 20
        : 0;
  // Through the shared table rather than a second set of literals: this screen and the
  // rewards tab's teaser card each used to keep their own, and they drifted.
  const yieldPercentage = isBenefitNumber(live?.yieldBoostPercentage)
    ? live.yieldBoostPercentage
    : TIER_YIELD_BOOST_RATES[tier];
  const balanceCap = isBenefitNumber(live?.yieldBoostBalanceCap)
    ? live.yieldBoostBalanceCap
    : tier === RewardsTier.PRIME
      ? 10_000
      : tier === RewardsTier.ULTRA
        ? 25_000
        : 0;
  const yieldRate = `${yieldPercentage > 0 ? '+' : ''}${yieldPercentage}%`;

  // One resolution of this tier's category rates, shared by the cashback rows
  // and the perk copy, so the panel and the prose beside it cannot disagree.
  // It also carries the design rates for a backend that sends none, which is
  // why the ride and airline figures no longer come off the fallback table.
  const category = categoryCashbackPresentation(
    tier,
    subscriptionPercentage,
    live?.subscriptionCategoryRates,
  );
  /** A rate to advertise: 0 for a category this tier is locked out of or an admin paused. */
  const earns = (key: string): number => category.rateFor(key);
  const ridePercentage = earns('rides');
  const airlinePercentage = earns('airlines');

  return {
    ...fallback,
    subscriptionRate: hasSubscriptionRate
      ? `${subscriptionPercentage}%`
      : fallback.subscriptionRate,
    rideRate: ridePercentage > 0 ? formatCashbackRate(ridePercentage) : null,
    airlineRate: airlinePercentage > 0 ? formatCashbackRate(airlinePercentage) : null,
    subscriptionCategories: category.categories,
    stats: fallback.stats.map(stat => ({
      ...stat,
      value:
        stat.label === 'Subscriptions'
          ? `${subscriptionPercentage}%`
          : stat.label === 'Yield boost'
            ? yieldRate
            : stat.value,
    })),
    perks: fallback.perks
      // An airline perk with nothing behind it is an advert for a category the
      // backend has stopped paying, so the row goes rather than reading "0%".
      // Icons are named on the perk, not taken from its position, so dropping
      // one does not slide the others onto the wrong glyph.
      .filter(perk => perk.icon !== 'airline' || airlinePercentage > 0)
      .map(perk => ({
        ...perk,
        // Rides drop out of the title as well as the copy: a perk headed
        // "& ride rewards" is an advert for them, which is the one thing
        // pausing a category has to stop.
        title:
          perk.icon === 'subscription' && ridePercentage <= 0 ? 'Subscription rewards' : perk.title,
        description:
          perk.icon === 'yield'
            ? `${yieldRate} APY on up to ${balanceCapLabel(balanceCap)} in savings`
            : perk.icon === 'subscription'
              ? ridePercentage > 0
                ? `${subscriptionPercentage}% on subscriptions, ${formatCashbackRate(
                    ridePercentage,
                  )} on rides`
                : `${subscriptionPercentage}% on subscriptions`
              : perk.icon === 'airline'
                ? `${formatCashbackRate(airlinePercentage)} back on 12 global airlines`
                : perk.description,
      })),
  };
}

const FEE_ROWS = [
  ['virtual_card', 'Virtual Card'],
  ['bank_deposit', 'Bank deposit'],
  ['swap', 'Swaps'],
  ['fx', 'FX conversion'],
  ['offramp', 'Bank withdrawal'],
] as const;

/** The v4 design is the missing-data fallback; an actual billing table always wins. */
export function tierPresentationFees(tier: RewardsTier, live?: TierFees) {
  if (live?.lines?.length) return { lines: live.lines, cashbackCap: live.cashbackCap };
  return {
    lines: FEE_ROWS.map(([key, label]) => ({
      key,
      label,
      value:
        key === 'virtual_card' ||
        tier === RewardsTier.ULTRA ||
        (tier === RewardsTier.PRIME && (key === 'fx' || key === 'offramp'))
          ? 'Free'
          : tier === RewardsTier.PRIME
            ? '0.25%'
            : '0.5%',
    })),
    cashbackCap: `Up to $${tier === RewardsTier.CORE ? 50 : tier === RewardsTier.PRIME ? 100 : 200}/Month`,
  };
}

export function tierOfferRows(offer: TierOffer | undefined) {
  if (!offer) return [];
  const rows: { label: string; value: string }[] = [];
  if (offer.cashAvailable && offer.annualFeeUsd != null && offer.annualFeeUsd > 0) {
    rows.push({
      label: 'Annual membership',
      value: `$${offer.annualFeeUsd.toLocaleString('en-US')}/year`,
    });
  }
  if (offer.lockAvailable && offer.lockFuse > 0) {
    rows.push({
      label: rows.length ? 'Or lock FUSE' : 'Lock FUSE',
      value: `${offer.lockFuse / 1000}K FUSE`,
    });
  }
  return rows;
}

export function tierOfferSubtitle(offer: TierOffer | undefined) {
  const rows = tierOfferRows(offer);
  if (rows.length === 2) return `${rows[0].value} or ${rows[1].value} locked`;
  if (rows.length === 1)
    return rows[0].label === 'Lock FUSE' ? `Requires ${rows[0].value} locked` : rows[0].value;
  return null;
}
