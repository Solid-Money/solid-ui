import { getAsset } from '@/lib/assets';
import { RewardsTier } from '@/lib/types';

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
