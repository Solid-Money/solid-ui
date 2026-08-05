import type { ReactElement } from 'react';

export interface CashbackDetailsData {
  cashbackRate: number;
  cashbackThisMonth: number;
  maxCashbackMonthly: number;
  allTimeCashback: number;
}

export interface CashbackDetailsSheetProps extends CashbackDetailsData {
  trigger: ReactElement<{ onPress?: () => void }>;
  onGetMoreCashback: () => void;
  triggerContainerClassName?: string;
}
