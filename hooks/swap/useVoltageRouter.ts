import { useEffect, useMemo, useState } from 'react';
import { ExtendedNative } from '@cryptoalgebra/fuse-sdk';
import * as Sentry from '@sentry/react-native';
import { Currency, CurrencyAmount, Percent, TradeType } from '@voltage-finance/sdk-core';

import { VOLTAGE_FINANCE_API_ROUTER } from '@/constants/routing';
import { WFUSE_TOKEN } from '@/constants/tokens';

interface Source {
  name: string;
  proportion: number;
}

export interface VoltageTrade {
  inputAmount?: CurrencyAmount<Currency>;
  outputAmount?: CurrencyAmount<Currency>;
  data?: string;
  allowanceTarget?: string;
  to?: string;
  value?: CurrencyAmount<Currency>;
  priceImpact?: Percent;
  tradeType?: TradeType;
  sources?: Source[];
  price?: number;
}

interface Quote {
  sellAmount: string;
  buyAmount: string;
  data: string;
  allowanceTarget: string;
  value: string;
  to: string;
  price: string;
  sources: Source[];
  estimatedPriceImpact: string;
}

async function getTrade(
  inputToken: string,
  outputToken: string,
  inputAmount: string,
  exactIn: boolean,
  slippage: string,
): Promise<Quote> {
  return new Promise((resolve, reject) => {
    const typeOfAmount = exactIn ? 'sellAmount' : 'buyAmount';

    fetch(
      `${VOLTAGE_FINANCE_API_ROUTER}?sellToken=${inputToken}&buyToken=${outputToken}&${typeOfAmount}=${inputAmount}&slippagePercentage=${slippage}`,
    )
      .then(response => {
        if (response.status === 200) {
          resolve(response.json());
        } else {
          reject(new Error('Failed to fetch quote'));
        }
      })
      .catch(error => reject(error));
  });
}

function getToken(currency?: Currency) {
  return currency ? (currency.isToken ? currency.address : currency.symbol) : undefined;
}

export function useVoltageRouter(
  inputCurrency: Currency | ExtendedNative | undefined,
  outputCurrency: Currency | ExtendedNative | undefined,
  parsedAmount: CurrencyAmount<Currency> | undefined,
  isExactIn: boolean,
  slippage: string,
): { trade: VoltageTrade | undefined; isLoading: boolean; isValid: boolean } {
  const [quote, setQuote] = useState<Quote | null>(null);
  const [quoteLoading, setQuoteLoading] = useState<boolean>(false);

  const inputToken = getToken(inputCurrency);

  const outputToken = getToken(outputCurrency);

  const amount = useMemo(() => parsedAmount?.quotient.toString(), [parsedAmount]);

  useEffect(() => {
    let canceled = false;

    if (inputToken && outputToken && amount && slippage) {
      setQuote(null);
      setQuoteLoading(true);

      getTrade(inputToken, outputToken, amount, isExactIn, slippage)
        .then(qoute => {
          if (!canceled) {
            setQuote(qoute);
            setQuoteLoading(false);
          }
        })
        .catch(error => {
          console.error('Failed to get Voltage trade quote:', error);
          Sentry.captureException(error, {
            tags: {
              type: 'voltage_quote_error',
            },
            extra: {
              inputToken,
              outputToken,
              amount,
              isExactIn,
              slippage,
            },
          });
          setQuote(null);
          setQuoteLoading(false);
        });
    }

    return () => {
      canceled = true;
    };
  }, [amount, inputToken, isExactIn, outputToken, slippage]);

  // Derive isValid from quote state instead of using setState in useMemo
  const isValid = Boolean(quote && inputCurrency && outputCurrency);

  const trade = useMemo(() => {
    if (!quote || !inputCurrency || !outputCurrency) {
      return undefined;
    }
    return {
      inputAmount: CurrencyAmount.fromRawAmount(inputCurrency, quote.sellAmount),
      outputAmount: CurrencyAmount.fromRawAmount(outputCurrency, quote.buyAmount),
      data: quote.data,
      allowanceTarget: quote.allowanceTarget,
      value: CurrencyAmount.fromRawAmount(WFUSE_TOKEN, quote.value),
      priceImpact: new Percent(
        String(parseInt(String(+quote.estimatedPriceImpact * 100))),
        String(10000),
      ),
      price: parseFloat(quote.price),
      to: quote.to,
      tradeType: isExactIn ? TradeType.EXACT_INPUT : TradeType.EXACT_OUTPUT,
      sources: quote.sources,
    };
  }, [inputCurrency, isExactIn, outputCurrency, quote]);

  return {
    trade,
    isLoading: quoteLoading,
    isValid,
  };
}
