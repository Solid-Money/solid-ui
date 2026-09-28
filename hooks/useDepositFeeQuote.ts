import { useQuery } from '@tanstack/react-query';

import { getDepositFeeQuote } from '@/lib/api';
import { CardProvider } from '@/lib/types';
import { withRefreshToken } from '@/lib/utils';

export const DEPOSIT_FEE_QUOTE_QUERY_KEY = 'deposit-fee-quote';

/**
 * What the backend would charge a deposit to this destination, on this chain,
 * in this currency: the rate set for its route and chain, or the 0.03% default.
 *
 * `provider` is not sent - the backend resolves the issuer itself - but it is
 * in the key, so learning of an issuer switch asks again rather than quoting the
 * old card's route.
 *
 * Cached for 30 seconds, the backend's own cache window for the rate grid, so a
 * rate an admin changes shows up about as fast as it starts being charged.
 */
export const useDepositFeeQuote = ({
  destinationType,
  chainId,
  symbol,
  provider,
  enabled,
}: {
  destinationType: 'PROTOCOL' | 'RAIN_CARD';
  chainId: number;
  symbol?: string;
  provider: CardProvider | null | undefined;
  enabled: boolean;
}) =>
  useQuery({
    queryKey: [DEPOSIT_FEE_QUOTE_QUERY_KEY, destinationType, chainId, symbol, provider ?? null],
    queryFn: () =>
      withRefreshToken(() => getDepositFeeQuote(destinationType, chainId, symbol as string)),
    enabled: enabled && !!symbol,
    staleTime: 30 * 1000,
    retry: 1,
  });
