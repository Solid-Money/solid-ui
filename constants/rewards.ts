import { getAsset } from '@/lib/assets';
import { RewardsTier, RewardsUserData, TierBenefitItem, TierBenefits } from '@/lib/types';

export const getTierDisplayName = (tier: RewardsTier) => {
  const names: Record<RewardsTier, string> = {
    [RewardsTier.CORE]: 'Core',
    [RewardsTier.PRIME]: 'Prime',
    [RewardsTier.ULTRA]: 'Ultra',
  };
  return names[tier] || tier;
};

export const getTierIcon = (tier: RewardsTier) => {
  switch (tier) {
    case RewardsTier.CORE:
      return getAsset('images/star-yellow-core.png');
    case RewardsTier.PRIME:
      return getAsset('images/star-yellow-prime.png');
    case RewardsTier.ULTRA:
      return getAsset('images/star-yellow-ultra.png');
  }
};

export const MOCK_REWARDS_USER_DATA: RewardsUserData = {
  currentTier: RewardsTier.CORE,
  totalPoints: 100,
  nextTierPoints: 1000,
  nextTier: RewardsTier.PRIME,
  savingsAPY: 11,
  cashbackRate: 2,
  cashbackThisMonth: 9,
  maxCashbackMonthly: 20,
};

export const MOCK_TIER_BENEFITS: TierBenefits[] = [
  {
    tier: RewardsTier.CORE,
    depositBoost: {
      title: 'Base yield',
    },
    cardCashback: {
      title: '2%',
    },
    subscriptionDiscount: null,
    cardCashbackCap: {
      title: 'Up to 20$\nmonthly',
    },
    subscriptionDiscountCap: null,
    cardFees: {
      title: 'No fees',
    },
    bankDeposit: {
      title: 'No fees',
      subtitle: 'First party - Unlimited\nThird party - 4K Max',
    },
    swapFees: {
      title: 'No fees',
    },
    support: {
      title: 'Basic',
    },
  },
  {
    tier: RewardsTier.PRIME,
    depositBoost: {
      title: 'Base yield + 5% APY',
    },
    cardCashback: {
      title: '3%',
    },
    subscriptionDiscount: {
      title: '25% Discount',
      image: 'images/spotify-openai-netflix.png',
    },
    cardCashbackCap: {
      title: 'Up to 20$\nmonthly',
    },
    subscriptionDiscountCap: {
      title: '$70 per service\nper month',
    },
    cardFees: {
      title: 'No fees',
    },
    bankDeposit: {
      title: 'No fees',
      subtitle: 'First party - Unlimited\nThird party - 4K Max',
    },
    swapFees: {
      title: 'No fees',
    },
    support: {
      title: 'Priority',
    },
  },
  {
    tier: RewardsTier.ULTRA,
    depositBoost: {
      title: 'Base yield + 5% APY',
    },
    cardCashback: {
      title: '5%',
    },
    subscriptionDiscount: {
      title: '50% Discount',
      image: 'images/spotify-openai-netflix.png',
    },
    cardCashbackCap: {
      title: 'Unlimited',
    },
    subscriptionDiscountCap: {
      title: '$70 per service\nper month',
    },
    cardFees: {
      title: 'No fees',
    },
    bankDeposit: {
      title: 'No fees',
      subtitle: 'First party - Unlimited\nThird party - 4K Max',
    },
    swapFees: {
      title: 'No fees',
    },
    support: {
      title: 'Priority',
    },
  },
];

export const TIER_BENEFITS: Record<RewardsTier, TierBenefitItem[]> = {
  [RewardsTier.CORE]: [
    {
      icon: 'images/dollar-yellow.png',
      title: '11% APY',
      description: 'On your savings',
    },
    {
      icon: 'images/two-percent-yellow.png',
      title: '2% Cashback',
      description: 'for every purchase',
    },
    {
      icon: 'images/rocket-yellow.png',
      title: 'Free virtual card',
      description: '200M+ Visa merchants',
    },
  ],
  [RewardsTier.PRIME]: [
    {
      icon: 'images/dollar-yellow.png',
      title: 'Base yield + 5% APY',
      description: 'On your savings',
    },
    {
      icon: 'images/two-percent-yellow.png',
      title: '3% Cashback',
      description: 'for every purchase',
    },
    {
      icon: 'images/rocket-yellow.png',
      title: 'Free virtual card',
      description: '200M+ Visa merchants',
    },
  ],
  [RewardsTier.ULTRA]: [
    {
      icon: 'images/dollar-yellow.png',
      title: 'Base yield + 5% APY',
      description: 'On your savings',
    },
    {
      icon: 'images/two-percent-yellow.png',
      title: '5% Cashback',
      description: 'for every purchase',
    },
    {
      icon: 'images/rocket-yellow.png',
      title: 'Free virtual card',
      description: '200M+ Visa merchants',
    },
  ],
};
