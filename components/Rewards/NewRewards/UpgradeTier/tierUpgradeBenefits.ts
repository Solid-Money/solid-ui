import { formatCashbackRate } from '@/components/Rewards/NewRewards/categoryCashback';
import { RewardsTier, TierBenefits } from '@/lib/types';

/** One line of the tier card's benefit list. */
export interface TierUpgradeBenefit {
  key: 'cashback' | 'yield-boost' | 'subscription' | 'rides' | 'cashback-cap';
  label: string;
}

const SUBSCRIPTION_CATEGORIES = [
  { key: 'ai', label: 'AI' },
  { key: 'streaming', label: 'streaming' },
  { key: 'music', label: 'music' },
] as const;

const isPositiveRate = (rate: number | undefined): rate is number =>
  typeof rate === 'number' && Number.isFinite(rate) && rate > 0;

/** Group only categories that still earn the same rate in the backend configuration. */
const subscriptionLabel = (benefits: TierBenefits): string | undefined => {
  const groups = new Map<number, string[]>();

  for (const category of SUBSCRIPTION_CATEGORIES) {
    const rate =
      benefits.subscriptionCategoryRates === undefined
        ? benefits.subscriptionDiscountRate
        : benefits.subscriptionCategoryRates.find(entry => entry.key === category.key)?.rate;
    if (!isPositiveRate(rate)) continue;
    const labels = groups.get(rate) ?? [];
    labels.push(category.label);
    groups.set(rate, labels);
  }

  if (groups.size) {
    return [...groups]
      .map(([rate, labels]) => {
        const categories =
          labels.length > 1
            ? `${labels.slice(0, -1).join(', ')} and ${labels[labels.length - 1]}`
            : labels[0];
        return `${formatCashbackRate(rate)} on ${categories}`;
      })
      .join('\n');
  }

  // Backends without either structured rate field still supply their own display copy.
  if (
    benefits.subscriptionCategoryRates === undefined &&
    benefits.subscriptionDiscountRate === undefined
  ) {
    const discount = benefits.subscriptionDiscount;
    return discount?.subtitle ? `${discount.title} ${discount.subtitle}` : discount?.title;
  }
};

/**
 * The benefits of the offered tier, as the upgrade card lists them.
 *
 * Read the same `tier-benefits` payload as the comparison screen. Category
 * cashback names the eligible categories and quotes rides separately; paused
 * or unavailable categories are omitted.
 */
export const resolveTierUpgradeBenefits = (
  benefits: TierBenefits | undefined,
): TierUpgradeBenefit[] => {
  if (!benefits) return [];

  const subscriptions = subscriptionLabel(benefits);
  const ridesRate = benefits.subscriptionCategoryRates?.find(entry => entry.key === 'rides')?.rate;

  const lines: (TierUpgradeBenefit | null)[] = [
    benefits.cardCashback?.title
      ? { key: 'cashback', label: `${benefits.cardCashback.title} cashback` }
      : null,
    benefits.depositBoost?.title
      ? { key: 'yield-boost', label: `${benefits.depositBoost.title} yield boost` }
      : null,
    subscriptions ? { key: 'subscription', label: subscriptions } : null,
    isPositiveRate(ridesRate)
      ? { key: 'rides', label: `${formatCashbackRate(ridesRate)} on rides` }
      : null,
    benefits.cardCashbackCap?.title
      ? {
          key: 'cashback-cap',
          label: benefits.cardCashbackCap.title
            .replace(/\s*\n\s*/g, ' ')
            .replace(/^Up to\s+/i, '')
            .replace(/\bmonthly$/, 'monthly cashback cap'),
        }
      : null,
  ];

  return lines.filter((line): line is TierUpgradeBenefit => line !== null);
};

/** The benefits block for one tier, from the list the endpoint returns. */
export const findTierBenefits = (
  benefits: TierBenefits[] | undefined,
  tier: RewardsTier,
): TierBenefits | undefined => benefits?.find(entry => entry.tier === tier);
