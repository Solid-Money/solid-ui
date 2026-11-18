import { formatBalance } from '@/lib/utils';
import { CURRENCY_SYMBOLS } from '@/lib/utils/cardHelpers';

import {
  cashbackFiguresByCurrency,
  monthlyCashbackTotal,
  resolveCashbackMonth,
} from './cashbackProgress';

import type { RewardsUserData } from './types';

/** Monthly earnings include the capped pending payout in each currency. */
export const formatMonthlyCashback = (rewards: RewardsUserData | undefined): string =>
  cashbackFiguresByCurrency(
    {
      USD: monthlyCashbackTotal(rewards?.cashbackThisMonth, rewards?.cashbackPendingThisMonth),
      EUR: monthlyCashbackTotal(
        rewards?.cashbackEur?.cashbackThisMonth,
        rewards?.cashbackEur?.cashbackPendingThisMonth,
      ),
    },
    resolveCashbackMonth(rewards)?.currency ?? 'USD',
  )
    .map(({ value, currency }) => formatBalance(value, CURRENCY_SYMBOLS[currency]))
    .join(' + ');
