import { RewardsTier, type TierBenefits } from '@/lib/types';

import { formatCashbackRate } from './categoryCashback';

const positiveRateLabel = (rate: number | undefined): string | null =>
  typeof rate === 'number' && Number.isFinite(rate) && rate > 0 ? formatCashbackRate(rate) : null;

/** Quote the tier being offered, including category changes and pauses from admin config. */
export const joinTierClubBenefits = (
  tier: RewardsTier.PRIME | RewardsTier.ULTRA,
  tierBenefits?: TierBenefits[],
) => {
  const benefits = tierBenefits?.find(entry => entry.tier === tier);
  const categories = benefits?.subscriptionCategoryRates;
  // Older APIs supply one rate for AI, streaming and music.
  const aiRate =
    categories === undefined
      ? benefits?.subscriptionDiscountRate
      : categories.find(category => category.key === 'ai')?.rate;
  const yieldBoost = positiveRateLabel(benefits?.yieldBoostPercentage);

  return {
    cashback: benefits?.cardCashback?.title?.trim() || null,
    yieldBoost: yieldBoost ? `+${yieldBoost}` : null,
    aiCashback: positiveRateLabel(aiRate),
  };
};
