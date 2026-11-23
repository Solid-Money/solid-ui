import { useTokenPriceUsd } from '@/hooks/useToken';
import {
  monthlyCashbackCap,
  resolveAllTimeCashback,
  resolveCashbackMonth,
  resolveMonthlyCashback,
  sumCashbackInCurrency,
} from '@/lib/cashbackProgress';
import { formatBalance } from '@/lib/utils';
import { formatCardCurrency } from '@/lib/utils/cardCurrency';
import { CURRENCY_SYMBOLS } from '@/lib/utils/cardHelpers';

import type { CardDetailsResponseDto, RewardsUserData } from '@/lib/types';

export const useCashbackDetails = (
  rewards: RewardsUserData | undefined,
  cardDetails: Pick<CardDetailsResponseDto, 'main_currency' | 'balances' | 'cashback'> | undefined,
) => {
  const currency =
    cardDetails?.main_currency ??
    rewards?.cashbackCurrency ??
    cardDetails?.cashback?.currency ??
    'USD';
  const month = resolveCashbackMonth(rewards, currency);
  const monthly = resolveMonthlyCashback(rewards);
  const lifetime = resolveAllTimeCashback(rewards, cardDetails?.cashback);
  const cap = monthlyCashbackCap(month);
  const tierCap = month?.maxCashbackMonthly;
  const capCurrency = month?.currency ?? currency;

  const cardRate = cardDetails?.balances?.available_in_eur?.usd_per_eur ?? 0;
  const hasCardRate = Number.isFinite(cardRate) && cardRate > 0;
  const needsRate =
    (cap > 0 && capCurrency !== currency) ||
    [...monthly, ...lifetime].some(figure => figure.value > 0 && figure.currency !== currency);
  const { data: eurcPriceUsd } = useTokenPriceUsd(!hasCardRate && needsRate ? 'EURC' : '');
  const usdPerEur = hasCardRate ? cardRate : Number(eurcPriceUsd);

  const monthlyTotal = sumCashbackInCurrency(monthly, currency, usdPerEur);
  const lifetimeTotal = sumCashbackInCurrency(lifetime, currency, usdPerEur);
  const symbol = CURRENCY_SYMBOLS[currency];
  const formatCap = (value: number) => {
    const total = sumCashbackInCurrency([{ value, currency: capCurrency }], currency, usdPerEur);
    return total === undefined
      ? undefined
      : formatCardCurrency(total, currency, { trimWhole: true });
  };

  return {
    currency,
    monthlyCashbackLabel:
      monthlyTotal === undefined ? undefined : formatBalance(monthlyTotal, symbol),
    monthlyCapLabel: formatCap(cap) ?? '—',
    tierMonthlyCapLabel: tierCap !== undefined && cap > tierCap ? formatCap(tierCap) : undefined,
    allTimeCashbackLabel: lifetimeTotal === undefined ? '—' : formatBalance(lifetimeTotal, symbol),
  };
};
