import { createContext, createElement, ReactNode, useCallback, useContext, useMemo } from 'react';
import { Percent } from '@cryptoalgebra/fuse-sdk';
import { useQuery } from '@tanstack/react-query';
import { formatUnits, parseUnits, zeroAddress } from 'viem';
import { useShallow } from 'zustand/react/shallow';

import { CHAIN_NAMES } from '@/constants/chains';
import { swapAssetKey } from '@/constants/swapChains';
import { useQuoteInput } from '@/hooks/swap/useQuoteInput';
import { findSwapAsset, useSwapAssets } from '@/hooks/swap/useSwapAssets';
import useUser from '@/hooks/useUser';
import { fetchLifiSwapQuote, LifiSwapApiError } from '@/lib/api/lifi-swap';
import {
  LifiRouteOrder,
  LifiSwapQuote,
  SwapAsset,
  SwapAssetWithBalance,
} from '@/lib/types/lifi-swap';
import { SwapField } from '@/lib/types/swap-field';
import { withRefreshToken } from '@/lib/utils';
import { useSwapState } from '@/store/swapStore';
import { useUserSlippageToleranceWithDefault } from '@/store/userStore';

/** How often a quote on screen is refreshed while the user looks at it. */
export const LIFI_QUOTE_REFRESH_MS = 20_000;

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
  /** Why the swap can't go ahead, in the button's words. */
  inputError: string | undefined;
  /** Fraction, e.g. 0.005. */
  slippage: number;
  /** Which route LI.FI picks; switching it re-quotes. */
  routeOrder: LifiRouteOrder;
  setRouteOrder: (order: LifiRouteOrder) => void;
  /**
   * Fetches a fresh quote just before signing. Resolves to it, or to undefined
   * when it now pays out less than the one on screen guaranteed.
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

  const quoteError = useMemo(() => {
    if (!canQuote || !error) return undefined;
    if (error instanceof LifiSwapApiError) return error.message;
    return 'Could not get a quote. Try again.';
  }, [canQuote, error]);

  const isQuoteStale =
    !!quote && (quoteInput.pending || quote.fromAmount !== amountToQuote?.toString());
  const isQuoting = canQuote && (quoteInput.pending || (isFetching && !quote) || isQuoteStale);

  const fromBalance = hasBalance(fromAsset) ? fromAsset.balanceRaw : assetsLoading ? undefined : 0n;

  // LI.FI's transaction carries a native value: the amount itself on a native
  // swap, and on some routes a bridge fee paid on top. Gas is sponsored, that
  // value is not, so the Safe has to hold it on the source chain.
  const activeQuote = canQuote ? quote : undefined;
  const nativeShortfall = useMemo(() => {
    if (!activeQuote || !fromAsset) return undefined;
    const required = BigInt(activeQuote.transactionRequest.value || '0');
    if (required <= 0n) return undefined;
    const native = findSwapAsset(assets, fromAsset.chainId, zeroAddress);
    if (!hasBalance(native) || native.balanceRaw >= required) return undefined;
    return { asset: native, required };
  }, [activeQuote, fromAsset, assets]);

  const inputError = useMemo(() => {
    if (!user) return 'Connect Wallet';
    if (!fromAsset || !toAsset) return 'Select a token';
    if (samePair) return 'Select a different token';
    if (!fromAmount || fromAmount <= 0n) return 'Enter an amount';
    const network = CHAIN_NAMES[fromAsset.chainId] ?? 'this network';
    if (fromBalance !== undefined && fromBalance < fromAmount) {
      return `Not enough ${fromAsset.symbol} on ${network}`;
    }
    if (nativeShortfall) {
      const { asset, required } = nativeShortfall;
      const amount = formatUnits(required, asset.decimals);
      return fromAsset.isNative
        ? `Not enough ${asset.symbol} on ${network} for the amount plus the bridge fee (${amount} ${asset.symbol})`
        : `This route needs ${amount} ${asset.symbol} on ${network} for its bridge fee`;
    }
    return undefined;
  }, [user, fromAsset, toAsset, samePair, fromAmount, fromBalance, nativeShortfall]);

  const refreshQuote = useCallback(async () => {
    const previous = quote;
    const { data: fresh } = await refetch();
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
    inputError,
    slippage,
    routeOrder,
    setRouteOrder,
    refreshQuote,
  };
}

function toBaseUnits(value: string, asset: SwapAsset | undefined): bigint | undefined {
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
