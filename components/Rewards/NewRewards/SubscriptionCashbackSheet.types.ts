import type { ReactElement } from 'react';

export interface SubscriptionCashbackData {
  /** Cashback % the tier earns back on eligible subscriptions. */
  subscriptionDiscountRate: number;
}

export interface SubscriptionCashbackSheetProps extends SubscriptionCashbackData {
  trigger: ReactElement<{ onPress?: () => void }>;
  onGetMoreCashback: () => void;
  triggerContainerClassName?: string;
}
