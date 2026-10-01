import { useCallback, useMemo } from 'react';
import { Currency, CurrencyAmount, Trade, TradeType } from '@cryptoalgebra/fuse-sdk';

import { TradeState, TradeStateType } from '@/lib/types/trade-state';
import { quotedAmount, QuoterResult, selectBestQuote } from '@/lib/utils/swap/quotes';

import { useAllRoutes } from './useAllRoutes';
import { useQuotesResults } from './useQuotesResults';

export interface BestTrade {
  state: TradeStateType;
  trade: Trade<Currency, Currency, TradeType> | null;
  fee?: readonly number[] | null;
  priceAfterSwap?: readonly bigint[] | null;
  /**
   * Fetches a fresh quote for the route `trade` is on. Resolves with that
   * route's new amount (the output on exact-in, the input on exact-out), or
   * undefined when there's no trade or the route can't be priced right now.
   */
  requote: () => Promise<bigint | undefined>;
}

/**
 * The best Algebra trade for a swap, in either direction.
 *
 * `amount` is the side the user fixed: the input on exact-in, the output on
 * exact-out. Routes come from the currency pair alone, so they're found before
 * an amount is typed and the first quote only waits on the quoter.
 */
export function useBestTrade(
  tradeType: TradeType,
  amount: CurrencyAmount<Currency> | undefined,
  currencyIn: Currency | undefined,
  currencyOut: Currency | undefined,
): BestTrade {
  const exactInput = tradeType === TradeType.EXACT_INPUT;
  const { routes, loading: routesLoading } = useAllRoutes(currencyIn, currencyOut);
  const {
    data: quotesResults,
    isLoading: isQuotesLoading,
    refetch,
  } = useQuotesResults({ routes, exactInput, amount });

  const best = useMemo(() => selectBestQuote(quotesResults, tradeType), [quotesResults, tradeType]);

  const requote = useCallback(async () => {
    if (!best) return undefined;
    const { data } = await refetch();
    const result = data?.[best.index]?.result as QuoterResult | undefined;
    return result ? quotedAmount(result, tradeType) : undefined;
  }, [best, refetch, tradeType]);

  return useMemo(() => {
    if (!amount || !currencyIn || !currencyOut) {
      return { state: TradeState.INVALID, trade: null, requote };
    }

    if (routesLoading || isQuotesLoading) {
      return { state: TradeState.LOADING, trade: null, requote };
    }

    if (!best) {
      return {
        state: TradeState.NO_ROUTE_FOUND,
        trade: null,
        fee: null,
        priceAfterSwap: null,
        requote,
      };
    }

    const quoted = CurrencyAmount.fromRawAmount(
      exactInput ? currencyOut : currencyIn,
      best.amount.toString(),
    );

    return {
      state: TradeState.VALID,
      trade: Trade.createUncheckedTrade({
        route: routes[best.index],
        tradeType,
        inputAmount: exactInput ? amount : quoted,
        outputAmount: exactInput ? quoted : amount,
      }),
      fee: best.fee,
      priceAfterSwap: best.priceAfterSwap,
      requote,
    };
  }, [
    amount,
    currencyIn,
    currencyOut,
    routesLoading,
    isQuotesLoading,
    best,
    routes,
    tradeType,
    exactInput,
    requote,
  ]);
}
