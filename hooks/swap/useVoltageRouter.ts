import { Currency, CurrencyAmount, Percent, TradeType } from '@voltage-finance/sdk-core';
import { useEffect, useMemo, useState } from 'react';
import * as Sentry from '@sentry/react-native';

import { VOLTAGE_FINANCE_API_ROUTER } from '@/constants/routing';
import { WFUSE_TOKEN } from '@/constants/tokens';
import { ExtendedNative } from '@cryptoalgebra/fuse-sdk';

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
  const [isValid, setIsValid] = useState<boolean>(false);

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
        .catch((error) => {
          console.error('Failed to get Voltage trade quote:', error);
          Sentry.captureException(error, {
            tags: {
              type: 'voltage_quote_error',
            },
            extra: {
              inputToken: inputToken?.symbol,
              outputToken: outputToken?.symbol,
              amount: amount?.toSignificant(),
              isExactIn,
              slippage: slippage?.toSignificant(2),
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

  return useMemo(() => {
    let trade: VoltageTrade | undefined;
    if (!quote || !inputCurrency || !outputCurrency) {
      trade = undefined;
      setIsValid(false);
    } else {
      trade = {
        inputAmount: CurrencyAmount.fromRawAmount(inputCurrency, quote.sellAmount),
        outputAmount: CurrencyAmount.fromRawAmount(outputCurrency, quote.buyAmount),
        data: quote.data,
        allowanceTarget: quote.allowanceTarget,
        value: CurrencyAmount.fromRawAmount(WFUSE_TOKEN, quote.value),
        priceImpact: new Percent(String(parseInt(String(+quote.estimatedPriceImpact * 100))), String(10000)),
        price: parseFloat(quote.price),
        to: quote.to,
        tradeType: isExactIn ? TradeType.EXACT_INPUT : TradeType.EXACT_OUTPUT,
        sources: quote.sources,
      };
      setIsValid(true);
    }

    return {
      trade,
      isLoading: quoteLoading,
      isValid,
    };
  }, [inputCurrency, isExactIn, outputCurrency, quote, quoteLoading, isValid]);
}
