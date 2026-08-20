import type { ReactElement } from 'react';

export interface YieldBoostData {
  /** Extra APY the tier adds on top of the base savings yield, in points. */
  yieldBoostPercentage: number;
  /** Ceiling on boost payouts for the tier, in USD. 0 hides the cap copy. */
  yieldBoostCap: number;
  /** Boost payouts the user has received so far, in USD. */
  yieldBoostEarned: number;
}

export interface YieldBoostSheetProps extends YieldBoostData {
  trigger: ReactElement<{ onPress?: () => void }>;
  triggerContainerClassName?: string;
}
