import type { ReactElement } from 'react';

export interface YieldBoostData {
  /** Extra APY the tier adds on top of the base savings yield, in points. */
  yieldBoostPercentage: number;
  /** Ceiling on boost payouts for the tier, in USD. 0 hides the cap copy. */
  yieldBoostCap: number;
  /** Boost payouts the user has received so far, in USD. */
  yieldBoostEarned: number;
  /**
   * Savings balance the boost is paid on, in USD (Prime $10K, Ultra $25K).
   * When set, the copy describes the FUSE boost and its cap; absent or 0 keeps
   * the older payout-cap wording for a backend that doesn't send it yet.
   */
  yieldBoostBalanceCap?: number;
}

export interface YieldBoostSheetProps extends YieldBoostData {
  trigger: ReactElement<{ onPress?: () => void }>;
  triggerContainerClassName?: string;
}
