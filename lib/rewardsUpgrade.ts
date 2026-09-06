import { RewardsTier, RewardsUserData } from '@/lib/types';

const ranks: Record<RewardsTier, number> = { core: 0, prime: 1, ultra: 2 };

export const isHigherTier = (tier?: RewardsTier, current?: RewardsTier) =>
  tier !== undefined && current !== undefined && ranks[tier] > ranks[current];

export const getTierAction = (
  selected: RewardsTier,
  current?: RewardsTier,
  unavailable = false,
) => {
  if (!current || unavailable) return 'unavailable';
  if (selected === current) return 'current';
  return isHigherTier(selected, current) ? 'upgrade' : 'included';
};

// Values here come from the confirmed user's rewards response, not the selected
// rung or a quote. Missing optional benefits must not be promised.
export const getConfirmedUpgradeBenefits = (data: RewardsUserData): string[] => {
  const benefits: string[] = [];
  if (data.cashbackRate > 0) benefits.push(`${data.cashbackRate}% card cashback`);
  if (data.maxCashbackMonthly > 0)
    benefits.push(`$${data.maxCashbackMonthly} monthly cashback cap`);
  if ((data.yieldBoostPercentage ?? 0) > 0) {
    benefits.push(`+${data.yieldBoostPercentage}% savings APY boost`);
    if ((data.yieldBoostCap ?? 0) > 0)
      benefits.push(`Yield boost payouts capped at $${data.yieldBoostCap}`);
  }
  if ((data.subscriptionDiscountRate ?? 0) > 0 && (data.subscriptionCategoryLimit ?? 0) > 0)
    benefits.push(
      `${data.subscriptionDiscountRate}% cashback on eligible subscriptions in ${data.subscriptionCategoryLimit} categories per month`,
    );
  return benefits;
};

// Runs beyond the backend's 60-second soFUSE balance cache, then stops.
export const REWARDS_RECONCILIATION_MS = 90_000;
export const REWARDS_RECONCILIATION_INTERVAL_MS = 5_000;
