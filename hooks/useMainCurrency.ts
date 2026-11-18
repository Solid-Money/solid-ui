import { useCallback, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { formatUsd, ONE_USD } from '@/constants/cardSpendModule';
import { BASE_SPEND_DEPLOYMENT } from '@/constants/spendModuleDeployments';
import { useBalances } from '@/hooks/useBalances';
import { useCardSpendDeployments } from '@/hooks/useEuroSpendEnablement';
import { setCardMainCurrency } from '@/lib/api';
import { ADDRESSES } from '@/lib/config';
import { CardDetailsResponseDto, MainCurrency } from '@/lib/types';
import { formatEur, usdToEur } from '@/lib/utils/cardCurrency';
import { baseEurcHeld } from '@/lib/utils/cardSpendable';
import { useUserStore } from '@/store/useUserStore';

import { cardDetailsQueryOptions } from './cardDetailsQueryOptions';

/**
 * The card details read, without the Rain balance poll `useCardDetails` adds — the main currency
 * and the euro rate ride on it, and every balance on screen asks for them.
 */
const useCardDetailsRead = () => {
  const userId = useUserStore(state => state.users.find(user => user.selected)?.userId);
  return { userId, ...useQuery(cardDetailsQueryOptions(userId)) };
};

/**
 * The cardholder's main currency as the backend records it, and the rate a euro display uses.
 *
 * Dollars until the card details answer, and for any card that is not Wirex — only a Wirex card
 * carries `main_currency`.
 */
export const useMainCurrency = () => {
  const { userId, data, isLoading } = useCardDetailsRead();
  const queryClient = useQueryClient();

  const mainCurrency: MainCurrency = data?.main_currency ?? 'USD';
  const usdPerEur = data?.balances?.available_in_eur?.usd_per_eur;

  const mutation = useMutation({
    mutationFn: setCardMainCurrency,
    onSuccess: ({ main_currency }) => {
      // Written into the cached details at once, so every balance on screen flips with the press
      // rather than a refetch later; the refetch then brings the backend's own figures.
      queryClient.setQueryData<CardDetailsResponseDto | null>(
        cardDetailsQueryOptions(userId).queryKey,
        previous => (previous ? { ...previous, main_currency } : previous),
      );
      void queryClient.invalidateQueries({ queryKey: cardDetailsQueryOptions(userId).queryKey });
    },
  });

  return {
    mainCurrency,
    usdPerEur,
    isLoading: !!userId && isLoading,
    save: mutation.mutateAsync,
    isSaving: mutation.isPending,
  };
};

/**
 * Formats card figures in the cardholder's main currency.
 *
 * Every card figure is counted in dollars — the modules' unit — so a euro main currency converts
 * them for display at the price the card spends EURC at. When that rate is not known yet the
 * figures stay in dollars rather than guess one. The home Balance follows too: a cardholder who
 * switched to euros read a euro spendable tile under a dollar total, and asked why only half the
 * screen switched.
 */
export const useCardDisplayCurrency = () => {
  const { mainCurrency, usdPerEur } = useMainCurrency();
  const inEuros = mainCurrency === 'EUR' && !!usdPerEur && usdPerEur > 0;

  /** A 6-decimal USD amount, as `formatUsd` takes it. */
  const formatMicroUsd = useCallback(
    (amount: bigint): string =>
      inEuros
        ? formatEur(usdToEur(Number(amount) / Number(ONE_USD), usdPerEur!))
        : formatUsd(amount),
    [inEuros, usdPerEur],
  );

  /** A USD amount, always with cents — the balance-panel shape. */
  const formatUsdAmount = useCallback(
    (usd: number): string => {
      const value = inEuros ? usdToEur(usd, usdPerEur!) : usd;
      return value.toLocaleString('en-US', {
        style: 'currency',
        currency: inEuros ? 'EUR' : 'USD',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
    },
    [inEuros, usdPerEur],
  );

  /** A USD amount in the display currency, as a number — for figures that count up. */
  const toDisplayAmount = useCallback(
    (usd: number): number => (inEuros ? usdToEur(usd, usdPerEur!) : usd),
    [inEuros, usdPerEur],
  );

  const symbol = inEuros ? '€' : '$';

  return { inEuros, usdPerEur, symbol, formatMicroUsd, formatUsdAmount, toDisplayAmount };
};

/**
 * Whether the cardholder holds any euros on Base the card could pay with once EURC is on: EURC,
 * or soEUR. Read from the loaded balances whether or not EURC is on yet — this is what decides the
 * "No EURC yet" banner, which is about having euros at all.
 */
export const useHoldsBaseEuros = (): boolean => {
  const { tokens } = useBalances();
  const { data } = useCardSpendDeployments();

  return useMemo(() => {
    if (baseEurcHeld(tokens, data?.deployments) > 0) return true;

    const soEur = ADDRESSES.base.soEurcVault?.toLowerCase();
    if (!soEur) return false;

    return (tokens ?? []).some(
      token =>
        token.chainId === BASE_SPEND_DEPLOYMENT.chainId &&
        token.contractAddress?.toLowerCase() === soEur &&
        Number(token.balance ?? 0) > 0,
    );
  }, [tokens, data?.deployments]);
};

export default useMainCurrency;
