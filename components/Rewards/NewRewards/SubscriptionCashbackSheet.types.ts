import type { RewardsTier, SubscriptionCategoryRate } from '@/lib/types';
import type { ReactElement } from 'react';

export interface SubscriptionCashbackData {
  currentTier: RewardsTier;
  /**
   * Cashback % the tier earns back on eligible subscriptions. A single figure,
   * so it only describes the subscription categories; kept for backends that
   * do not send {@link subscriptionCategoryRates} yet.
   */
  subscriptionDiscountRate: number;
  /**
   * What the tier earns on each category, in percentage points. Preferred over
   * {@link subscriptionDiscountRate} when present, because rates differ per
   * category (Prime: 10% on AI, 8% on Rides, nothing on Airlines).
   */
  subscriptionCategoryRates?: SubscriptionCategoryRate[];
}

export interface SubscriptionCashbackSheetProps extends SubscriptionCashbackData {
  trigger: ReactElement<{ onPress?: () => void }>;
  onGetMoreCashback: () => void;
  onUpgradeTier?: (tier: RewardsTier.PRIME | RewardsTier.ULTRA) => void;
  triggerContainerClassName?: string;
}
