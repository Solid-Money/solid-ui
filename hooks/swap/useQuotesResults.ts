import { useMemo } from 'react';
import { Currency, CurrencyAmount, encodeRouteToPath, Route } from '@cryptoalgebra/fuse-sdk';
import { useReadContracts } from 'wagmi';

import { ALGEBRA_QUOTER_V2 } from '@/constants/addresses';
import { algebraQuoterV2ABI } from '@/lib/abis';
import { fuseConfig } from '@/lib/wagmi';

/** How often a quote left on screen is re-fetched, so it can't go stale. */
const QUOTE_REFRESH_MS = 15_000;

export function useQuotesResults({
  routes,
  exactInput,
  amount,
}: {
  routes: Route<Currency, Currency>[];
  exactInput: boolean;
  /** The input on exact-in, the output on exact-out. */
  amount?: CurrencyAmount<Currency>;
}) {
  const quoteInputs = useMemo(
    () =>
      amount
        ? routes.map(route => [
            encodeRouteToPath(route, !exactInput),
            `0x${amount.quotient.toString(16)}`,
          ])
        : [],
    [amount, routes, exactInput],
  );

  const functionName = exactInput ? 'quoteExactInput' : 'quoteExactOutput';

  const {
    data: quotesResults,
    isLoading,
    refetch,
  } = useReadContracts({
    contracts: quoteInputs.map((quote: any) => ({
      address: ALGEBRA_QUOTER_V2,
      abi: algebraQuoterV2ABI,
      functionName: functionName,
      args: quote,
    })),
    config: fuseConfig,
    query: {
      enabled: quoteInputs.length > 0,
      staleTime: 5_000,
      refetchInterval: QUOTE_REFRESH_MS,
    },
  });

  return {
    data: quotesResults,
    isLoading,
    refetch,
  };
}
