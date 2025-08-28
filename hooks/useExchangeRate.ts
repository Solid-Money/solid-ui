import {
  BridgeTransferCryptoCurrency,
  BridgeTransferFiatCurrency,
} from '@/components/BankTransfer/enums';
import { getExchangeRate } from '@/lib/api';
import { ExchangeRateResponse, FromCurrency, ToCurrency } from '@/lib/types';
import { useEffect, useState } from 'react';

const REFRESH_INTERVAL = 30000; // 30 seconds

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

export const useExchangeRate = (
  fromCurrency: BridgeTransferFiatCurrency | BridgeTransferCryptoCurrency,
  toCurrency: BridgeTransferFiatCurrency | BridgeTransferCryptoCurrency,
) => {
  const [rate, setRate] = useState<ExchangeRateResponse | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    let intervalId: ReturnType<typeof setInterval>;

    const fetchRate = async () => {
      try {
        setLoading(true);

        // Special case: If both currencies are USD-based (USD/USDC/USDT)
        const isFromUSDBased =
          fromCurrency === BridgeTransferFiatCurrency.USD ||
          fromCurrency === BridgeTransferCryptoCurrency.USDC ||
          fromCurrency === BridgeTransferCryptoCurrency.USDT;

        const isToUSDBased =
          toCurrency === BridgeTransferFiatCurrency.USD ||
          toCurrency === BridgeTransferCryptoCurrency.USDC ||
          toCurrency === BridgeTransferCryptoCurrency.USDT;

        if (isFromUSDBased && isToUSDBased) {
          if (isMounted) {
            setRate({
              midmarket_rate: '1',
              buy_rate: '1',
              sell_rate: '1',
            });
            setError(null);
            setLoading(false);
          }
          return;
        }

        // For all other cases, convert using USD as the base currency
        // Example: EUR -> USDT becomes EUR -> USD
        // Example: MXN -> USDC becomes MXN -> USD
        const from = mapCurrencyToFromCurrency(fromCurrency);
        const to = mapCurrencyToToCurrency(toCurrency);
        const response = await getExchangeRate(from, to);
        if (isMounted) {
          setRate(response);
          setError(null);
        }
      } catch (err) {
        if (isMounted) {
          setError(err as Error);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    // Initial fetch
    fetchRate();

    // Set up interval for auto-refresh only if we're not dealing with USD-based pairs
    const isUSDBasedPair =
      (fromCurrency === BridgeTransferFiatCurrency.USD ||
        fromCurrency === BridgeTransferCryptoCurrency.USDC ||
        fromCurrency === BridgeTransferCryptoCurrency.USDT) &&
      (toCurrency === BridgeTransferFiatCurrency.USD ||
        toCurrency === BridgeTransferCryptoCurrency.USDC ||
        toCurrency === BridgeTransferCryptoCurrency.USDT);

    if (!isUSDBasedPair) {
      intervalId = setInterval(fetchRate, REFRESH_INTERVAL);
    }

    // Cleanup
    return () => {
      isMounted = false;
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [fromCurrency, toCurrency]);

  return { rate, error, loading };
};
