import { RewardsTier, TierBenefits } from '@/lib/types';

/** One line of the tier card's benefit list. */
export interface TierUpgradeBenefit {
  key: 'cashback' | 'yield-boost' | 'subscription' | 'cashback-cap';
  label: string;
}

/**
 * The four things a tier gets you, as the upgrade card lists them.
 *
 * Read off the same `tier-benefits` payload the comparison screen renders, so
 * the card cannot promise a rate the comparison table contradicts. A benefit the
 * backend has no copy for is dropped rather than rendered empty — a tier card
 * with three true lines is better than one with four and a blank.
 *
 * `subscriptionDiscount` is null for a tier that does not grant it, which is why
 * it is the only one that has to be checked for existence rather than for text.
 */
export const resolveTierUpgradeBenefits = (
  benefits: TierBenefits | undefined,
): TierUpgradeBenefit[] => {
  if (!benefits) return [];

  const lines: (TierUpgradeBenefit | null)[] = [
    benefits.cardCashback?.title
      ? { key: 'cashback', label: `${benefits.cardCashback.title} Cashback` }
      : null,
    benefits.depositBoost?.title
      ? { key: 'yield-boost', label: `${benefits.depositBoost.title} Yield boost` }
      : null,
    benefits.subscriptionDiscount?.title
      ? {
          key: 'subscription',
          label: benefits.subscriptionDiscount.subtitle
            ? `${benefits.subscriptionDiscount.title} ${benefits.subscriptionDiscount.subtitle}`
            : benefits.subscriptionDiscount.title,
        }
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
