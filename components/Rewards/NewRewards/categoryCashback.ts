import { RewardsTier } from '@/lib/types';

export const CATEGORY_CASHBACK_TABS = [
  { key: 'ai', label: 'AI' },
  { key: 'streaming', label: 'Streaming' },
  { key: 'music', label: 'Music' },
  { key: 'rides', label: 'Rides' },
  { key: 'airlines', label: 'Airlines' },
] as const;

export type CashbackCategoryKey = (typeof CATEGORY_CASHBACK_TABS)[number]['key'];

/**
 * Subscription rates still come from rewards/user-data. Rides and airlines
 * have no separate API fields yet; these are the v4 Figma tier values, shared
 * by the category sheet's rate, locked state and headline.
 */
export const categoryCashbackPresentation = (
  tier: RewardsTier,
  subscriptionDiscountRate: number,
) => {
  const subscriptionRate =
    Number.isFinite(subscriptionDiscountRate) && subscriptionDiscountRate > 0
      ? subscriptionDiscountRate
      : 0;
  const rideRate = tier === RewardsTier.ULTRA ? 10 : tier === RewardsTier.PRIME ? 8 : 0;
  const airlineRate = tier === RewardsTier.ULTRA ? 10 : 0;
  const rates: Record<CashbackCategoryKey, number> = {
    ai: subscriptionRate,
    streaming: subscriptionRate,
    music: subscriptionRate,
    rides: rideRate,
    airlines: airlineRate,
  };

  return {
    rates,
    headlineRate: tier === RewardsTier.CORE ? 20 : Math.max(...Object.values(rates)),
    subtitle:
      tier === RewardsTier.CORE
        ? 'on subscriptions, rides and flights with Prime or Ultra'
        : tier === RewardsTier.ULTRA
          ? 'on subscriptions, rides and flights'
          : 'on subscriptions and rides',
    actionLabel:
      tier === RewardsTier.CORE
        ? 'Upgrade to Prime'
        : tier === RewardsTier.PRIME
          ? 'Upgrade to Ultra'
          : 'Got it',
    upgradeTier: tier === RewardsTier.CORE ? RewardsTier.PRIME : RewardsTier.ULTRA,
  };
};
