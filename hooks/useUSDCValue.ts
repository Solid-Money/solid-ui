import { useMemo } from 'react';
import { useQuery } from '@apollo/client/react';
import { Currency, CurrencyAmount, Price, tryParseAmount } from '@cryptoalgebra/fuse-sdk';

import { STABLECOINS_TOKENS } from '@/constants/tokens';
import { getAlgebraInfoClient } from '@/graphql/clients';
import { NativePriceDocument, SingleTokenDocument } from '@/graphql/generated/algebra-info';
import { buildTokenUsdPrice } from '@/lib/utils/tokenUsdPrice';

export function useUSDCPrice(currency: Currency | undefined) {
  const { data: bundles } = useQuery(NativePriceDocument, {
    client: getAlgebraInfoClient(),
  });

  const { data: token } = useQuery(SingleTokenDocument, {
    variables: {
      tokenId: currency ? currency.wrapped.address.toLowerCase() : '',
    },
    client: getAlgebraInfoClient(),
    skip: !currency,
  });

  return useMemo(() => {
    if (!currency || !bundles?.bundles?.[0] || !token?.token)
      return {
        price: undefined,
        formatted: 0,
      };

    if (STABLECOINS_TOKENS.USDT_V2.address.toLowerCase() === currency.wrapped.address.toLowerCase())
      return {
        price: new Price(STABLECOINS_TOKENS.USDT_V2, STABLECOINS_TOKENS.USDT_V2, '1', '1'),
        formatted: 1,
      };

    const tokenUSDValue =
      Number(token.token.derivedMatic) * Number(bundles.bundles[0].maticPriceUSD);
    const usdAmount = tryParseAmount(tokenUSDValue.toFixed(currency.decimals), currency);

    if (usdAmount) {
      return {
        // Built from the raw-units ratio rather than from `usdAmount`'s own
        // numerator/denominator. `Price` multiplies RAW amounts, so feeding it
        // a CurrencyAmount's fraction inflates every `quote()` by
        // 10^(2 * decimals - 6) — see buildTokenUsdPrice.
        price: buildTokenUsdPrice(currency, tokenUSDValue, STABLECOINS_TOKENS.USDT_V2),
        formatted: Number(usdAmount.toSignificant()),
      };
    }

    return {
      price: undefined,
      formatted: 0,
    };
  }, [currency, bundles, token]);
}

export function useUSDCValue(currencyAmount: CurrencyAmount<Currency> | undefined | null) {
  const { price, formatted } = useUSDCPrice(currencyAmount?.currency);

  return useMemo(() => {
    if (!price || !currencyAmount)
      return {
        price: null,
        formatted: null,
      };

    try {
      return {
        price: price.quote(currencyAmount),
        formatted: Number(currencyAmount.toSignificant()) * formatted,
      };
    } catch {
      return {
        price: null,
        formatted: null,
      };
    }
  }, [currencyAmount, price, formatted]);
}
