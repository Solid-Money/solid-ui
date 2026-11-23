import type { CashbackCurrency } from '@/lib/types';
import type { ReactElement } from 'react';

export interface CashbackDetailsData {
  cashbackRate: number;
  currency: CashbackCurrency;
  monthlyCashbackLabel?: string;
  monthlyCapLabel: string;
  /**
   * The current tier's cap, shown when purchases from a higher tier still
   * have a higher cap this month.
   */
  tierMonthlyCapLabel?: string;
  allTimeCashbackLabel: string;
}

export interface CashbackDetailsSheetProps extends CashbackDetailsData {
  trigger: ReactElement<{ onPress?: () => void }>;
  onGetMoreCashback: () => void;
  triggerContainerClassName?: string;
}
