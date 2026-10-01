import type { RewardsTier } from '@/lib/types';
import type { ReactElement } from 'react';

export interface SubscriptionCashbackData {
  currentTier: RewardsTier;
  /** Cashback % the tier earns back on eligible subscriptions. */
  subscriptionDiscountRate: number;
}

export interface SubscriptionCashbackSheetProps extends SubscriptionCashbackData {
  trigger: ReactElement<{ onPress?: () => void }>;
  onGetMoreCashback: () => void;
  onUpgradeTier?: (tier: RewardsTier.PRIME | RewardsTier.ULTRA) => void;
  triggerContainerClassName?: string;
}
