import { formatTierCashbackRate } from '@/lib/tierCashback';
import { RewardsTier, type TierBenefits, type TierFees, type TierOffer } from '@/lib/types';

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
      { value: '$0', label: 'Card cost' },
    ],
    perks: [
      { title: 'Free virtual card', description: 'Issued instantly' },
      { title: 'Set up in minutes', description: 'Under 5 minutes' },
      { title: 'Spend globally', description: 'Card accepted in 180+ countries' },
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
      { title: 'Yield boost', description: '+2% APY on up to $10K in savings' },
      { title: 'Subscription & ride rewards', description: '10% on subscriptions, 8% on rides' },
      { title: 'Higher cashback caps', description: 'Up to $100 cashback a month' },
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
      { title: 'Yield boost', description: '+3% APY on up to $25K in savings' },
      { title: 'Subscription & ride rewards', description: '20% on subscriptions, 10% on rides' },
      { title: 'Airline rewards', description: '10% back on 12 global airlines' },
    ],
  },
} as const;

export interface TierPresentationContent {
  headline: string;
  accent: string;
  subscriptionRate: string | null;
  rideRate: string | null;
  airlineRate: string | null;
  stats: { value: string; label: string }[];
  perks: { title: string; description: string }[];
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
  const yieldPercentage = isBenefitNumber(live?.yieldBoostPercentage)
    ? live.yieldBoostPercentage
    : tier === RewardsTier.PRIME
      ? 2
      : tier === RewardsTier.ULTRA
        ? 3
        : 0;
  const balanceCap = isBenefitNumber(live?.yieldBoostBalanceCap)
    ? live.yieldBoostBalanceCap
    : tier === RewardsTier.PRIME
      ? 10_000
      : tier === RewardsTier.ULTRA
        ? 25_000
        : 0;
  const yieldRate = `${yieldPercentage > 0 ? '+' : ''}${yieldPercentage}%`;

  return {
    ...fallback,
    subscriptionRate: hasSubscriptionRate
      ? `${subscriptionPercentage}%`
      : fallback.subscriptionRate,
    stats: fallback.stats.map(stat => ({
      ...stat,
      value:
        stat.label === 'Subscriptions'
          ? `${subscriptionPercentage}%`
          : stat.label === 'Yield boost'
            ? yieldRate
            : stat.value,
    })),
    perks: fallback.perks.map(perk => ({
      ...perk,
      description:
        perk.title === 'Yield boost'
          ? `${yieldRate} APY on up to ${balanceCapLabel(balanceCap)} in savings`
          : perk.title === 'Subscription & ride rewards'
            ? `${subscriptionPercentage}% on subscriptions, ${fallback.rideRate} on rides`
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
