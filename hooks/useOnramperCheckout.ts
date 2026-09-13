import { useEffect, useRef, useState } from 'react';

import useDebounce from '@/hooks/useDebounce';
import { describeOnramperError } from '@/lib/onramperErrors';

import type { OnramperClient, OnramperError, QuoteResponse } from '@onramper/onramper-react-native';
import type { ReactNode } from 'react';

/** Every amount is a checkout intent upstream — wait for typing to settle. */
const CHECKOUT_DEBOUNCE_MS = 600;

/**
 * Onramper's own brand button would sit oddly among our controls, so it is
 * restyled to match the brand CTA the rest of the funding flow uses.
 */
const BUTTON_STYLE = {
  backgroundColor: '#94F27F',
  foregroundColor: '#111111',
  borderRadius: 24,
};

export interface OnramperCheckoutParams {
  /** Onramper fiat id, e.g. 'usd'. */
  source?: string | null;
  /** Onramper asset id, e.g. 'usdc_base'. */
  destination?: string | null;
  /** Amount in `source`, as typed. */
  amount: string;
  /** e.g. 'applepay'. */
  paymentMethod?: string | null;
  /** ISO-3166 alpha-2, e.g. 'US'. Onramper refuses to price without one. */
  country?: string | null;
  /** Onramper network slug the asset settles on, e.g. 'base'. */
  network?: string | null;
  /** Destination Safe address. */
  address?: string | null;
}

interface UseOnramperCheckoutReturn {
  /** Native Apple Pay button for the current quote, or null while there isn't one. */
  button: ReactNode | null;
  quote: QuoteResponse | undefined;
  isLoading: boolean;
  error: OnramperError | undefined;
  /** True when the amount is outside the ramp's limits, rather than a real fault. */
  isAmountOutOfRange: boolean;
  /**
   * Why no checkout was attempted, when none was. Diagnostic only — the screen
   * shows it on qa/preview builds so an unattempted call is distinguishable
   * from a failed one.
   */
  blockedReason: string | undefined;
}

/**
 * Prepares an Onramper checkout for the current selection and hands back the
 * native button to render.
 *
 * `getCheckoutRequirements()` is both the quote call and the button factory —
 * there is no way to price without preparing an intent — so this is debounced
 * and single-flight: a stale response is discarded rather than replacing the
 * button belonging to the amount now on screen. That matters beyond tidiness,
 * because tapping a button prepared for a superseded amount would charge the
 * user that amount.
 */
export default function useOnramperCheckout(
  client: OnramperClient | undefined,
  params: OnramperCheckoutParams,
): UseOnramperCheckoutReturn {
  const { source, destination, amount, paymentMethod, country, network, address } = params;

  const debouncedAmount = useDebounce(amount, CHECKOUT_DEBOUNCE_MS);
  const numericAmount = Number(debouncedAmount);

  const [button, setButton] = useState<ReactNode | null>(null);
  const [quote, setQuote] = useState<QuoteResponse>();
  const [error, setError] = useState<OnramperError>();
  const [isLoading, setIsLoading] = useState(false);

  // Identifies the request a response belongs to. A plain `cancelled` flag is
  // not enough: effects for two amounts can be in flight at once, and the
  // second must win regardless of which resolves first.
  const requestId = useRef(0);

  /**
   * The first precondition `getCheckoutRequirements` is missing, or undefined
   * when there are none.
   *
   * Without this an unmet precondition and a failed call look identical on
   * screen — both leave the CTA at "Quote unavailable" with nothing said. They
   * are very different problems: a country Onramper doesn't serve returns no
   * assets, so `destination` is never set and the SDK is never even called.
   * Ordered so the most upstream cause is named first.
   */
  const missing = !client
    ? 'SDK not initialized'
    : !country
      ? 'no country'
      : !source
        ? 'no currency selected'
        : !destination
          ? 'no asset available for this currency'
          : !network
            ? 'asset has no network'
            : !paymentMethod
              ? 'no payment method for this country'
              : !address
                ? 'no wallet address'
                : !(Number.isFinite(numericAmount) && numericAmount > 0)
                  ? 'no amount entered'
                  : undefined;

  const isReady = !missing;

  useEffect(() => {
    const id = ++requestId.current;

    // `missing` already covers a null client; naming it again is what narrows
    // the type for the call below.
    if (!isReady || !client) {
      // Drop a button prepared for an earlier selection — leaving it on screen
      // would offer a checkout for something the inputs no longer describe.
      setButton(null);
      setQuote(undefined);
      setError(undefined);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(undefined);

    client
      .getCheckoutRequirements(
        {
          source: source as string,
          destination: destination as string,
          amount: numericAmount,
          type: 'buy',
          paymentMethod: paymentMethod as string,
          country: country as string,
          wallet: { network: network as string, address: address as string },
        },
        BUTTON_STYLE,
      )
      .then(({ button: nextButton, quote: nextQuote }) => {
        if (id !== requestId.current) return;
        setButton(nextButton);
        setQuote(nextQuote);
      })
      .catch((e: unknown) => {
        if (id !== requestId.current) return;
        // The screen has room for one sentence, and `quoteUnavailable` reads the
        // same whether the pair is unsold, the ramp is down, or the request was
        // malformed. The code and the pair are what separate those.
        console.error(
          `[Onramper] getCheckoutRequirements failed for ${source}->${destination} ` +
            `(${numericAmount} ${source}, ${paymentMethod}, ${country}): ` +
            describeOnramperError(e),
        );
        setButton(null);
        setQuote(undefined);
        setError(e as OnramperError);
      })
      .finally(() => {
        if (id !== requestId.current) return;
        setIsLoading(false);
      });
  }, [
    client,
    isReady,
    source,
    destination,
    numericAmount,
    paymentMethod,
    country,
    network,
    address,
  ]);

  return {
    button,
    quote,
    isLoading: isLoading || (isReady && amount !== debouncedAmount),
    error,
    // The amount being out of range is the input's problem to state, not a
    // failure worth an error screen.
    isAmountOutOfRange: error?.code === 'amountOutOfRange',
    blockedReason: missing,
  };
}
