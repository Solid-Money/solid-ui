import type { ReactElement } from 'react';

export interface CashbackDetailsData {
  cashbackRate: number;
  cashbackThisMonth: number;
  /** Earned this month but still escrowed; absent hides the pending row. */
  cashbackPendingThisMonth?: number;
  maxCashbackMonthly: number;
  allTimeCashback: number;
}

export interface CashbackDetailsSheetProps extends CashbackDetailsData {
  trigger: ReactElement<{ onPress?: () => void }>;
  onGetMoreCashback: () => void;
  triggerContainerClassName?: string;
}
