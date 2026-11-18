import { formatBalance } from '@/lib/utils';
import { CURRENCY_SYMBOLS } from '@/lib/utils/cardHelpers';

import {
  cashbackFiguresByCurrency,
  monthlyCashbackTotal,
  resolveCashbackMonth,
} from './cashbackProgress';

import type { CashbackFigure } from './cashbackProgress';
import type { RewardsUserData } from './types';

/** Per-currency figures side by side, in cents: "€2.00 + $7.60". */
export const formatCashbackFigures = (figures: CashbackFigure[]): string =>
  figures
    .map(({ value, currency }) => formatBalance(value, CURRENCY_SYMBOLS[currency]))
    .join(' + ');

/** Monthly earnings include the capped pending payout in each currency. */
export const formatMonthlyCashback = (rewards: RewardsUserData | undefined): string =>
  formatCashbackFigures(
    cashbackFiguresByCurrency(
      {
        USD: monthlyCashbackTotal(rewards?.cashbackThisMonth, rewards?.cashbackPendingThisMonth),
        EUR: monthlyCashbackTotal(
          rewards?.cashbackEur?.cashbackThisMonth,
          rewards?.cashbackEur?.cashbackPendingThisMonth,
        ),
      },
      resolveCashbackMonth(rewards)?.currency ?? 'USD',
    ),
  );
