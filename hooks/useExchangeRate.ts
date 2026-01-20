import { useQuery } from '@tanstack/react-query';

import {
  BridgeTransferCryptoCurrency,
  BridgeTransferFiatCurrency,
} from '@/components/BankTransfer/enums';
import { getExchangeRate } from '@/lib/api';
import { ExchangeRateResponse, FromCurrency, ToCurrency } from '@/lib/types';
import { withRefreshToken } from '@/lib/utils';

const EXCHANGE_RATE_KEY = 'exchange-rate';
const REFRESH_INTERVAL = 30 * 1000; // 30 seconds

// Helper function to convert BridgeTransfer currencies to API currencies
const mapCurrencyToFromCurrency = (
  currency: BridgeTransferFiatCurrency | BridgeTransferCryptoCurrency,
): FromCurrency => {
  if (
    currency === BridgeTransferCryptoCurrency.USDC ||
    currency === BridgeTransferCryptoCurrency.USDT
  ) {
    return FromCurrency.USD;
  }
  return currency.toLowerCase() as FromCurrency;
};

const mapCurrencyToToCurrency = (
  currency: BridgeTransferFiatCurrency | BridgeTransferCryptoCurrency,
): ToCurrency => {
  if (
    currency === BridgeTransferCryptoCurrency.USDC ||
    currency === BridgeTransferCryptoCurrency.USDT
  ) {
    return ToCurrency.USD;
  }
  return currency.toLowerCase() as ToCurrency;
};

// Check if both currencies are USD-based (USD/USDC/USDT)
const isUSDBasedPair = (
  fromCurrency: BridgeTransferFiatCurrency | BridgeTransferCryptoCurrency,
  toCurrency: BridgeTransferFiatCurrency | BridgeTransferCryptoCurrency,
): boolean => {
  const isFromUSDBased =
    fromCurrency === BridgeTransferFiatCurrency.USD ||
    fromCurrency === BridgeTransferCryptoCurrency.USDC ||
    fromCurrency === BridgeTransferCryptoCurrency.USDT;

  const isToUSDBased =
    toCurrency === BridgeTransferFiatCurrency.USD ||
    toCurrency === BridgeTransferCryptoCurrency.USDC ||
    toCurrency === BridgeTransferCryptoCurrency.USDT;

  return isFromUSDBased && isToUSDBased;
};

async function fetchExchangeRate(
  fromCurrency: BridgeTransferFiatCurrency | BridgeTransferCryptoCurrency,
  toCurrency: BridgeTransferFiatCurrency | BridgeTransferCryptoCurrency,
): Promise<ExchangeRateResponse> {
  // Special case: If both currencies are USD-based, return 1:1 rate
  if (isUSDBasedPair(fromCurrency, toCurrency)) {
    return {
      midmarket_rate: '1',
      buy_rate: '1',
      sell_rate: '1',
    };
  }

  // For all other cases, convert using USD as the base currency
  // Example: EUR -> USDT becomes EUR -> USD
  const from = mapCurrencyToFromCurrency(fromCurrency);
  const to = mapCurrencyToToCurrency(toCurrency);

  const response = await withRefreshToken(async () => getExchangeRate(from, to));
  if (!response) {
    throw new Error('Failed to fetch exchange rate');
  }
  return response;
}

export const useExchangeRate = (
  fromCurrency: BridgeTransferFiatCurrency | BridgeTransferCryptoCurrency,
  toCurrency: BridgeTransferFiatCurrency | BridgeTransferCryptoCurrency,
) => {
  const isUSD = isUSDBasedPair(fromCurrency, toCurrency);

  const {
    data: rate,
    error,
    isLoading,
    isFetching,
  } = useQuery({
    queryKey: [EXCHANGE_RATE_KEY, fromCurrency, toCurrency],
    queryFn: () => fetchExchangeRate(fromCurrency, toCurrency),
    gcTime: 5 * 60 * 1000, // 5 minutes - keep in cache
    // Only poll for non-USD pairs (USD pairs are always 1:1)
    refetchInterval: isUSD ? false : REFRESH_INTERVAL,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: !isUSD, // Don't refetch static USD pairs on focus
  });

  return {
    rate: rate ?? null,
    error: error ?? null,
    loading: isFetching,
    initialLoading: isLoading,
  };
};
