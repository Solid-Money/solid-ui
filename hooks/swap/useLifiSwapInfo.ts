import {
  createContext,
  createElement,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
} from 'react';
import { Percent } from '@cryptoalgebra/fuse-sdk';
import { useQuery } from '@tanstack/react-query';
import { formatUnits, parseUnits, zeroAddress } from 'viem';
import { useShallow } from 'zustand/react/shallow';

import { CHAIN_NAMES } from '@/constants/chains';
import { swapAssetKey } from '@/constants/swapChains';
import { TRACKING_EVENTS } from '@/constants/tracking-events';
import { SWAP_PRICE_RECHECK_MS, useQuoteInput } from '@/hooks/swap/useQuoteInput';
import { findSwapAsset, useSwapAssets } from '@/hooks/swap/useSwapAssets';
import useUser from '@/hooks/useUser';
import { track } from '@/lib/analytics';
import { fetchLifiSwapQuote, LifiSwapApiError } from '@/lib/api/lifi-swap';
import { SwapErrorCode, swapErrorCodeOf, swapErrorCopy } from '@/lib/swapErrors';
import {
  LifiRouteOrder,
  LifiSwapQuote,
  SwapAsset,
  SwapAssetWithBalance,
} from '@/lib/types/lifi-swap';
import { SwapField } from '@/lib/types/swap-field';
import { withRefreshToken } from '@/lib/utils';
import { formatSwapAmount } from '@/lib/utils/swap/format';
import { useSwapState } from '@/store/swapStore';
import { useUserSlippageToleranceWithDefault } from '@/store/userStore';

/** How often a quote on screen is refreshed while the user looks at it. */
export const LIFI_QUOTE_REFRESH_MS = SWAP_PRICE_RECHECK_MS;

const DEFAULT_SLIPPAGE = new Percent(50, 10_000); // 0.5%
/** The backend's accepted range, as a fraction. */
const MIN_SLIPPAGE = 0.001;
const MAX_SLIPPAGE = 0.05;

export interface LifiSwapInfo {
  fromAsset: SwapAssetWithBalance | SwapAsset | undefined;
  toAsset: SwapAssetWithBalance | SwapAsset | undefined;
  /** In base units; undefined while balances load. */
  fromBalance: bigint | undefined;
  /** What's typed, in base units. */
  fromAmount: bigint | undefined;
  quote: LifiSwapQuote | undefined;
  /** A quote for an amount that is no longer the one typed. */
  isQuoteStale: boolean;
  isQuoting: boolean;
  quoteError: string | undefined;
  /** Why the quote failed, for the button's label and for tracking. */
  quoteErrorCode: SwapErrorCode | undefined;
  /** Why the swap can't go ahead, in the button's words. */
  inputError: string | undefined;
  /** The code behind `inputError`, when it has one. */
  inputErrorCode: SwapErrorCode | undefined;
  /** Fraction, e.g. 0.005. */
  slippage: number;
  /** Which route LI.FI picks; switching it re-quotes. */
  routeOrder: LifiRouteOrder;
  setRouteOrder: (order: LifiRouteOrder) => void;
  /**
   * Fetches a fresh quote just before signing. Resolves to it, or to undefined
   * when it now pays out less than the one on screen guaranteed. Rejects when
   * the quote can't be refreshed at all.
   */
  refreshQuote: () => Promise<LifiSwapQuote | undefined>;
}

const LifiSwapInfoContext = createContext<LifiSwapInfo | undefined>(undefined);

/** Works out the LI.FI swap form's quote, balances and errors once for the whole form. */
export function LifiSwapInfoProvider({ children }: { children: ReactNode }) {
  const info = useLifiSwapInfoState();
  return createElement(LifiSwapInfoContext.Provider, { value: info }, children);
}

export function useLifiSwapInfo(): LifiSwapInfo {
  const info = useContext(LifiSwapInfoContext);
  if (!info) throw new Error('useLifiSwapInfo must be used inside a LifiSwapInfoProvider');
  return info;
}

const hasBalance = (asset: SwapAsset | undefined): asset is SwapAssetWithBalance =>
  !!asset && 'balance' in asset;

function useLifiSwapInfoState(): LifiSwapInfo {
  const { user } = useUser();
  const { input, output, typedValue, routeOrder, setRouteOrder } = useSwapState(
    useShallow(state => ({
      input: state[SwapField.INPUT],
      output: state[SwapField.OUTPUT],
      typedValue: state.typedValue,
      routeOrder: state.lifiRouteOrder,
      setRouteOrder: state.actions.setLifiRouteOrder,
    })),
  );

  const { assets, isLoading: assetsLoading } = useSwapAssets();
  const fromAsset = useMemo(
    () => findSwapAsset(assets, input.chainId, input.currencyId),
    [assets, input.chainId, input.currencyId],
  );
  const toAsset = useMemo(
    () => findSwapAsset(assets, output.chainId, output.currencyId),
    [assets, output.chainId, output.currencyId],
  );

  const slippagePercent = useUserSlippageToleranceWithDefault(DEFAULT_SLIPPAGE);
  const slippage = useMemo(() => {
    const fraction = Number(slippagePercent.toFixed(4)) / 100;
    return Math.min(Math.max(fraction, MIN_SLIPPAGE), MAX_SLIPPAGE);
  }, [slippagePercent]);

  const fromAmount = useMemo(() => toBaseUnits(typedValue, fromAsset), [typedValue, fromAsset]);

  // Quote what's typed once typing pauses.
  const quoteInput = useQuoteInput(SwapField.INPUT, typedValue);
  const amountToQuote = useMemo(
    () => toBaseUnits(quoteInput.typedValue, fromAsset),
    [quoteInput.typedValue, fromAsset],
  );

  const samePair = !!fromAsset && !!toAsset && swapAssetKey(fromAsset) === swapAssetKey(toAsset);
  const canQuote = !!user && !!fromAsset && !!toAsset && !samePair && !!amountToQuote;

  const queryKey = [
    'lifi-swap-quote',
    fromAsset && swapAssetKey(fromAsset),
    toAsset && swapAssetKey(toAsset),
    amountToQuote?.toString(),
    slippage,
    routeOrder,
  ];

  const {
    data: quote,
    error,
    isFetching,
    refetch,
  } = useQuery({
    queryKey,
    enabled: canQuote,
    queryFn: ({ signal }) =>
      withRefreshToken(() =>
        fetchLifiSwapQuote(
          {
            fromChain: fromAsset!.chainId,
            toChain: toAsset!.chainId,
            fromToken: fromAsset!.address,
            toToken: toAsset!.address,
            fromAmount: amountToQuote!.toString(),
            slippage,
            order: routeOrder,
          },
          signal,
        ),
      ) as Promise<LifiSwapQuote>,
    refetchInterval: LIFI_QUOTE_REFRESH_MS,
    staleTime: LIFI_QUOTE_REFRESH_MS / 2,
    // A route that doesn't exist won't appear on retry; a busy backend might.
    retry: (count, err) => !(err instanceof LifiSwapApiError && err.status < 500) && count < 2,
  });

  const quoteErrorCode = canQuote && error ? swapErrorCodeOf(error) : undefined;
  const quoteError = useMemo(() => {
    if (!quoteErrorCode) return undefined;
    // The backend sends the pair's minimum with AMOUNT_TOO_LOW, in base units.
    const minRaw = error instanceof LifiSwapApiError ? error.details.minFromAmount : undefined;
    const minAmount =
      typeof minRaw === 'string' && fromAsset
        ? formatSwapAmount(Number(formatUnits(BigInt(minRaw), fromAsset.decimals)))
        : undefined;
    return swapErrorCopy(quoteErrorCode, {
      from: fromAsset?.symbol,
      to: toAsset?.symbol,
      minAmount,
    });
  }, [quoteErrorCode, error, fromAsset, toAsset]);

  const isQuoteStale =
    !!quote && (quoteInput.pending || quote.fromAmount !== amountToQuote?.toString());

  // Once per pair and amount: the 20-second refresh of a price on screen is
  // not a new one, and a failure that repeats on refresh is the same failure.
  const trackedPrice = useRef('');
  const priceKey = queryKey.join('|');
  useEffect(() => {
    if (!canQuote || quoteInput.pending || !fromAsset || !toAsset) return;
    const outcome = quoteErrorCode ?? (quote && !isQuoteStale ? 'shown' : undefined);
    if (!outcome) return;
    const key = `${priceKey}|${outcome}`;
    if (trackedPrice.current === key) return;
    trackedPrice.current = key;
    const props = {
      trade_type: 'lifi',
      surface: 'swap',
      input_currency: fromAsset.symbol,
      output_currency: toAsset.symbol,
      from_chain_id: fromAsset.chainId,
      to_chain_id: toAsset.chainId,
      input_amount: quoteInput.typedValue,
    };
    if (outcome === 'shown' && quote) {
      track(TRACKING_EVENTS.SWAP_PRICE_SHOWN, {
        ...props,
        output_amount: formatUnits(BigInt(quote.toAmount), quote.toToken.decimals),
        input_amount_usd: quote.fromAmountUsd,
        total_fee_usd: quote.totalFee?.amountUsd ?? null,
        eta_seconds: quote.executionDurationSeconds,
      });
    } else {
      track(TRACKING_EVENTS.SWAP_PRICE_FAILED, { ...props, error_code: outcome });
    }
  }, [
    canQuote,
    quoteInput.pending,
    quoteInput.typedValue,
    fromAsset,
    toAsset,
    quote,
    isQuoteStale,
    quoteErrorCode,
    priceKey,
  ]);
  const isQuoting = canQuote && (quoteInput.pending || (isFetching && !quote) || isQuoteStale);

  const fromBalance = hasBalance(fromAsset) ? fromAsset.balanceRaw : assetsLoading ? undefined : 0n;

  // LI.FI's transaction carries a native value: the amount itself on a native
  // swap, and on some routes a bridge fee paid on top. Gas is sponsored, that
  // value is not, so the Safe has to hold it on the source chain. A sponsored
  // quote's bridge fee is the paymaster's, and its amount is the balance check's.
  const activeQuote = canQuote ? quote : undefined;
  const nativeShortfall = useMemo(() => {
    if (!activeQuote || !fromAsset || activeQuote.sponsorship) return undefined;
    const required = BigInt(activeQuote.transactionRequest.value || '0');
    if (required <= 0n) return undefined;
    const native = findSwapAsset(assets, fromAsset.chainId, zeroAddress);
    if (!hasBalance(native) || native.balanceRaw >= required) return undefined;
    return { asset: native, required };
  }, [activeQuote, fromAsset, assets]);

  const { inputError, inputErrorCode } = useMemo((): {
    inputError: string | undefined;
    inputErrorCode: SwapErrorCode | undefined;
  } => {
    const plain = (message: string) => ({ inputError: message, inputErrorCode: undefined });
    if (!user) return plain('Connect Wallet');
    if (!fromAsset || !toAsset) return plain('Select a token');
    if (samePair) {
      return { inputError: swapErrorCopy('SAME_TOKEN'), inputErrorCode: 'SAME_TOKEN' };
    }
    if (!fromAmount || fromAmount <= 0n) return plain('Enter an amount');
    const network = CHAIN_NAMES[fromAsset.chainId] ?? 'this network';
    if (fromBalance !== undefined && fromBalance < fromAmount) {
      return {
        inputError: `Not enough ${fromAsset.symbol} on ${network}`,
        inputErrorCode: 'NOT_ENOUGH_BALANCE',
      };
    }
    if (nativeShortfall) {
      const { asset, required } = nativeShortfall;
      const amount = formatUnits(required, asset.decimals);
      return {
        inputError: fromAsset.isNative
          ? `Not enough ${asset.symbol} on ${network} for the amount plus the bridge fee (${amount} ${asset.symbol})`
          : `This route needs ${amount} ${asset.symbol} on ${network} for its bridge fee`,
        inputErrorCode: 'NOT_ENOUGH_GAS_MONEY',
      };
    }
    return { inputError: undefined, inputErrorCode: undefined };
  }, [user, fromAsset, toAsset, samePair, fromAmount, fromBalance, nativeShortfall]);

  const refreshQuote = useCallback(async () => {
    const previous = quote;
    // A failed refetch still hands back the last quote as `data`. Signing that
    // would send calldata LI.FI may no longer honour, so fail instead.
    const { data: fresh, isError, error: refetchError } = await refetch();
    if (isError) {
      throw refetchError instanceof Error
        ? refetchError
        : new Error('Could not refresh the quote. Try again.');
    }
    if (!fresh) return undefined;
    // The route moved against the user past what they agreed to on screen.
    if (previous && BigInt(fresh.toAmount) < BigInt(previous.toAmountMin)) return undefined;
    return fresh;
  }, [quote, refetch]);

  return {
    fromAsset,
    toAsset,
    fromBalance,
    fromAmount,
    quote: activeQuote,
    isQuoteStale,
    isQuoting,
    quoteError,
    quoteErrorCode,
    inputError,
    inputErrorCode,
    slippage,
    routeOrder,
    setRouteOrder,
    refreshQuote,
  };
}

/** A typed amount in `asset`'s base units; undefined when it isn't a positive amount. */
export function toBaseUnits(value: string, asset: SwapAsset | undefined): bigint | undefined {
  if (!asset || !value || value === '.') return undefined;
  try {
    // Trim past the token's precision rather than refuse the whole amount.
    const [whole, fraction = ''] = value.split('.');
    const amount = parseUnits(
      fraction ? `${whole || '0'}.${fraction.slice(0, asset.decimals)}` : whole,
      asset.decimals,
    );
    return amount > 0n ? amount : undefined;
  } catch {
    return undefined;
  }
}
