import type { CashbackFigure } from '@/lib/cashbackProgress';
import type { CashbackCurrency } from '@/lib/types';
import type { ReactElement } from 'react';

export interface CashbackDetailsData {
  cashbackRate: number;
  /** Current cashback currency for the rate description and monthly cap. */
  currency?: CashbackCurrency;
  monthlyCashbackLabel: string;
  /** What this month's purchases are paid up to — see `monthlyCashbackCap`. */
  maxCashbackMonthly: number;
  /**
   * The cap of the tier held now. Passed when it can differ from
   * `maxCashbackMonthly`, so the sheet can say why the month's cap is higher
   * (purchases made during a trial that has since ended keep its cap).
   */
  tierMonthlyCap?: number;
  allTimeCashback: CashbackFigure[];
}

export interface CashbackDetailsSheetProps extends CashbackDetailsData {
  trigger: ReactElement<{ onPress?: () => void }>;
  onGetMoreCashback: () => void;
  triggerContainerClassName?: string;
}
