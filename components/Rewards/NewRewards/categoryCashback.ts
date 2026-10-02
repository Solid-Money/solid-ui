import { RewardsTier } from '@/lib/types';

export const CATEGORY_CASHBACK_TABS = [
  { key: 'ai', label: 'AI' },
  { key: 'streaming', label: 'Streaming' },
  { key: 'music', label: 'Music' },
] as const;

export type CashbackCategoryKey = (typeof CATEGORY_CASHBACK_TABS)[number]['key'];

/**
 * Only subscription categories are advertised. Their rates come from
 * rewards/user-data and determine both the category rows and the headline.
 */
export const categoryCashbackPresentation = (
  tier: RewardsTier,
  subscriptionDiscountRate: number,
) => {
  const subscriptionRate =
    Number.isFinite(subscriptionDiscountRate) && subscriptionDiscountRate > 0
      ? subscriptionDiscountRate
      : 0;
  const rates: Record<CashbackCategoryKey, number> = {
    ai: subscriptionRate,
    streaming: subscriptionRate,
    music: subscriptionRate,
  };

  return {
    rates,
    headlineRate: tier === RewardsTier.CORE ? 20 : Math.max(...Object.values(rates)),
    subtitle:
      tier === RewardsTier.CORE ? 'on subscriptions with Prime or Ultra' : 'on subscriptions',
    actionLabel:
      tier === RewardsTier.CORE
        ? 'Upgrade to Prime'
        : tier === RewardsTier.PRIME
          ? 'Upgrade to Ultra'
          : 'Got it',
    upgradeTier: tier === RewardsTier.CORE ? RewardsTier.PRIME : RewardsTier.ULTRA,
  };
};
