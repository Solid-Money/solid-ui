import { createContext, createElement, ReactNode, useCallback, useContext, useMemo } from 'react';
import { formatUnits, zeroAddress } from 'viem';
import { fuse } from 'viem/chains';
import { useShallow } from 'zustand/react/shallow';

import { SolidBridgeRoute } from '@/constants/swapChains';
import { SwapFlowError, SwapFlowModel, SwapFlowStop } from '@/hooks/swap/swapFlowTypes';
import { useBridgeFlowModel } from '@/hooks/swap/useBridgeFlowModel';
import { useLifiSwapCallback } from '@/hooks/swap/useLifiSwapCallback';
import { LifiSwapInfoProvider, useLifiSwapInfo } from '@/hooks/swap/useLifiSwapInfo';
import usePegSwapCallback, { PegSwapType } from '@/hooks/swap/usePegswapCallback';
import { findSwapAsset, useSwapAssets } from '@/hooks/swap/useSwapAssets';
import { useSwapCallback } from '@/hooks/swap/useSwapCallback';
import useWrapCallback, { WrapType } from '@/hooks/swap/useWrapCallback';
import { useSwapFeeRate } from '@/hooks/useProductFees';
import { assetDisplayName, swapFeeFootnote } from '@/lib/swapAssets';
import { SwapErrorCode, swapErrorCopy } from '@/lib/swapErrors';
import { SwapAsset, SwapAssetWithBalance } from '@/lib/types/lifi-swap';
import { SwapField } from '@/lib/types/swap-field';
import { TradeState } from '@/lib/types/trade-state';
import { lifiPriceImpact, sumFeesUsd } from '@/lib/utils/swap/lifi';
import { computeRealizedLPFeePercent, warningSeverity } from '@/lib/utils/swap/prices';
import {
  DerivedSwapInfoProvider,
  SwapReceipt,
  useDerivedSwapInfo,
  useIsLifiSwap,
  useSolidBridgeRoute,
  useSwapState,
} from '@/store/swapStore';
import { useUserState } from '@/store/userStore';

export { SwapFlowStop };
export type { SwapFlowError, SwapFlowModel };

const SwapFlowContext = createContext<SwapFlowModel | undefined>(undefined);

export function useSwapFlow(): SwapFlowModel {
  const model = useContext(SwapFlowContext);
  if (!model) throw new Error('useSwapFlow must be used inside a SwapFlowProvider');
  return model;
}

/**
 * Quotes and executes on Algebra for a Fuse pair, over Solid's bridge for the
 * pairs it takes between Fuse and another network, and on LI.FI for the rest.
 */
export function SwapFlowProvider({ children }: { children: ReactNode }) {
  const bridge = useSolidBridgeRoute();
  const isLifi = useIsLifiSwap();
  if (bridge) return createElement(BridgeFlow, { route: bridge }, children);
  return isLifi
    ? createElement(LifiSwapInfoProvider, null, createElement(LifiFlow, null, children))
    : createElement(DerivedSwapInfoProvider, null, createElement(FuseFlow, null, children));
}

function BridgeFlow({ route, children }: { route: SolidBridgeRoute; children?: ReactNode }) {
  const model = useBridgeFlowModel(route);
  return createElement(SwapFlowContext.Provider, { value: model }, children);
}

function LifiFlow({ children }: { children: ReactNode }) {
  const model = useLifiFlowModel();
  return createElement(SwapFlowContext.Provider, { value: model }, children);
}

function FuseFlow({ children }: { children: ReactNode }) {
  const model = useFuseFlowModel();
  return createElement(SwapFlowContext.Provider, { value: model }, children);
}

const human = (raw: string | bigint, decimals: number) =>
  Number(formatUnits(BigInt(raw), decimals));

const priceOf = (asset: SwapAsset | undefined) =>
  asset && 'priceUsd' in asset ? (asset as SwapAssetWithBalance).priceUsd : 0;

const usdAt = (amount: number | undefined, asset: SwapAsset | undefined) => {
  const price = priceOf(asset);
  return amount !== undefined && price > 0 ? amount * price : undefined;
};

const maxOf = (asset: SwapAsset | undefined, balance: bigint | undefined) =>
  asset && balance && balance > 0n ? formatUnits(balance, asset.decimals) : undefined;

const flowError = (
  code: SwapErrorCode,
  ctx: Parameters<typeof swapErrorCopy>[1] = {},
): SwapFlowError => ({ code, copy: swapErrorCopy(code, ctx) });

function useLifiFlowModel(): SwapFlowModel {
  const info = useLifiSwapInfo();
  const { swap, isSending } = useLifiSwapCallback();
  const { tierName } = useSwapFeeRate();
  const { isExpertMode } = useUserState();
  const typedValue = useSwapState(state => state.typedValue);
  const { fromAsset, toAsset, fromBalance, quote, isQuoting, refreshQuote } = info;

  const typed = Number(typedValue) || 0;
  const toAmount = quote && !isQuoting ? human(quote.toAmount, quote.toToken.decimals) : undefined;
  const fromUsd =
    usdAt(typed, fromAsset) ?? (quote?.fromAmountUsd ? Number(quote.fromAmountUsd) : undefined);
  const toUsd =
    toAmount === undefined
      ? undefined
      : (usdAt(toAmount, toAsset) ?? (quote?.toAmountUsd ? Number(quote.toAmountUsd) : undefined));

  const fee = useMemo(() => {
    if (!quote) return { usd: undefined, percentage: undefined };
    if (quote.totalFee) {
      return {
        usd: quote.totalFee.amountUsd === null ? null : Number(quote.totalFee.amountUsd),
        percentage: quote.totalFee.percentage,
      };
    }
    // A backend from before the total: add the lines up ourselves.
    const usd = sumFeesUsd(quote.fees);
    const from = Number(quote.fromAmountUsd);
    return { usd, percentage: from > 0 ? usd / from : null };
  }, [quote]);

  const severity = useMemo(() => {
    const impact = lifiPriceImpact(quote);
    return impact ? warningSeverity(impact) : 0;
  }, [quote]);

  const names = {
    from: assetDisplayName(fromAsset ?? { symbol: '' }),
    to: toAsset && assetDisplayName(toAsset),
  };
  const error = useMemo((): SwapFlowError | undefined => {
    if (!typedValue) return undefined;
    if (info.inputErrorCode === 'NOT_ENOUGH_BALANCE') {
      return flowError('NOT_ENOUGH_BALANCE', { from: names.from });
    }
    if (info.inputErrorCode && info.inputError) {
      return { code: info.inputErrorCode, copy: info.inputError };
    }
    if (info.quoteErrorCode && info.quoteError) {
      // Copy built with the screen's names, not the token symbols.
      return {
        code: info.quoteErrorCode,
        copy:
          info.quoteErrorCode === 'NO_ROUTE'
            ? swapErrorCopy('NO_ROUTE', { from: names.from, to: names.to })
            : info.quoteError,
      };
    }
    if (severity > 3 && !isExpertMode) return flowError('PRICE_IMPACT_TOO_HIGH');
    return undefined;
  }, [
    typedValue,
    info.inputErrorCode,
    info.inputError,
    info.quoteErrorCode,
    info.quoteError,
    severity,
    isExpertMode,
    names.from,
    names.to,
  ]);

  const isCrossChain = !!fromAsset && !!toAsset && fromAsset.chainId !== toAsset.chainId;

  const recheck = useCallback(async () => !!(await refreshQuote()), [refreshQuote]);

  const execute = useCallback(async (): Promise<SwapReceipt | undefined> => {
    // LI.FI's calldata expires; sign the fresh quote unless it now pays less.
    const fresh = await refreshQuote();
    if (!fresh) throw new SwapFlowStop('PRICE_CHANGED');
    const result = await swap(fresh);
    if (result.kind === 'cancelled') return undefined;
    const freshFee = fresh.totalFee?.amountUsd;
    return {
      kind: result.kind === 'bridging' ? 'bridging' : 'completed',
      fromAmount: human(fresh.fromAmount, fresh.fromToken.decimals),
      fromName: assetDisplayName(fresh.fromToken),
      toAmount: human(fresh.toAmount, fresh.toToken.decimals),
      toName: assetDisplayName(fresh.toToken),
      toAsset: toAsset!,
      feeUsd: freshFee ? Number(freshFee) : (fee.usd ?? undefined),
      completedAt: Date.now(),
      transactionHash: result.transactionHash,
      fromChainId: fresh.fromChainId,
      toChainId: fresh.toChainId,
      clientTxId: result.kind === 'bridging' ? result.clientTxId : undefined,
    };
  }, [refreshQuote, swap, toAsset, fee.usd]);

  return {
    route: 'lifi',
    isLegacyPair: false,
    fromAsset,
    toAsset,
    fromBalance,
    maxValue: maxOf(fromAsset, fromBalance),
    typedValue,
    toAmount,
    fromUsd,
    toUsd,
    rate: toAmount !== undefined && typed > 0 ? toAmount / typed : undefined,
    feeUsd: fee.usd,
    feePercentage: fee.percentage,
    feeFootnote: quote && quote.solidFee.percentage > 0 ? swapFeeFootnote(tierName) : undefined,
    etaSeconds: quote ? (isCrossChain ? quote.executionDurationSeconds : 0) : undefined,
    isCrossChain,
    isQuoting,
    error,
    canReview: !!typedValue && !!quote && !isQuoting && !error,
    isSending,
    recheck,
    execute,
  };
}

function useFuseFlowModel(): SwapFlowModel {
  const derived = useDerivedSwapInfo();
  const { tierName } = useSwapFeeRate();
  const { isExpertMode } = useUserState();
  const { typedValue, inputId, outputId } = useSwapState(
    useShallow(state => ({
      typedValue: state.typedValue,
      inputId: state[SwapField.INPUT].currencyId,
      outputId: state[SwapField.OUTPUT].currencyId,
    })),
  );
  const { assets } = useSwapAssets();
  const fromAsset = useMemo(
    () => findSwapAsset(assets, fuse.id, inputId ?? zeroAddress),
    [assets, inputId],
  );
  // No "You get" is none, not FUSE: the picker clears it when a new "You pay"
  // can't reach it.
  const toAsset = useMemo(
    () => (outputId ? findSwapAsset(assets, fuse.id, outputId) : undefined),
    [assets, outputId],
  );

  const {
    currencies,
    currencyBalances,
    toggledTrade: trade,
    tradeState,
    allowedSlippage,
    inputError,
    swapFee,
    revenueWalletAddress,
    refreshQuote,
  } = derived;

  const { wrapType } = useWrapCallback(
    currencies[SwapField.INPUT],
    currencies[SwapField.OUTPUT],
    typedValue,
  );
  const { pegSwapType } = usePegSwapCallback(
    currencies[SwapField.INPUT],
    currencies[SwapField.OUTPUT],
    typedValue,
  );
  const isLegacyPair =
    wrapType !== WrapType.NOT_APPLICABLE || pegSwapType !== PegSwapType.NOT_APPLICABLE;

  const feeCollection = useMemo(
    () => ({ fee: swapFee, revenueWalletAddress }),
    [swapFee, revenueWalletAddress],
  );
  const {
    callback: swapCallback,
    isLoading: isSending,
    error: callbackError,
  } = useSwapCallback(trade, allowedSlippage, undefined, feeCollection);

  const balance = currencyBalances[SwapField.INPUT];
  const fromBalance = balance
    ? BigInt(balance.quotient.toString())
    : fromAsset && 'balanceRaw' in fromAsset
      ? (fromAsset as SwapAssetWithBalance).balanceRaw
      : undefined;

  const typed = Number(typedValue) || 0;
  // SYNCING is the 30-second re-check of a price already on screen: keep
  // showing it rather than blank the form and the review every half minute.
  const isQuoting =
    !!typedValue &&
    (tradeState.state === TradeState.LOADING ||
      (tradeState.state === TradeState.SYNCING && !trade));
  const toAmount = trade && !isQuoting ? Number(trade.outputAmount.toExact()) : undefined;
  const feeAmount = fromAsset ? human(swapFee.feeAmount, fromAsset.decimals) : 0;
  const feeUsd = swapFee.feeAmount > 0n ? (usdAt(feeAmount, fromAsset) ?? null) : 0;

  const severity = useMemo(() => {
    if (!trade) return 0;
    return warningSeverity(trade.priceImpact?.subtract(computeRealizedLPFeePercent(trade)));
  }, [trade]);

  const fromName = fromAsset ? assetDisplayName(fromAsset) : undefined;
  const toName = toAsset ? assetDisplayName(toAsset) : undefined;
  const error = useMemo((): SwapFlowError | undefined => {
    if (!typedValue || isLegacyPair) return undefined;
    if (inputError?.startsWith('Not enough')) {
      return flowError('NOT_ENOUGH_BALANCE', { from: fromName });
    }
    if (inputError) return { code: 'QUOTE_UNAVAILABLE', copy: inputError };
    if (isQuoting) return undefined;
    if (tradeState.state === TradeState.NO_ROUTE_FOUND || trade?.swaps.length === 0) {
      return flowError('NO_ROUTE', { from: fromName, to: toName });
    }
    if (severity > 3 && !isExpertMode) return flowError('PRICE_IMPACT_TOO_HIGH');
    if (trade && !swapCallback) {
      return {
        code: 'QUOTE_UNAVAILABLE',
        copy: callbackError ?? swapErrorCopy('QUOTE_UNAVAILABLE'),
      };
    }
    return undefined;
  }, [
    typedValue,
    isLegacyPair,
    inputError,
    isQuoting,
    tradeState.state,
    trade,
    severity,
    isExpertMode,
    swapCallback,
    callbackError,
    fromName,
    toName,
  ]);

  const recheck = useCallback(() => refreshQuote(), [refreshQuote]);

  const execute = useCallback(async (): Promise<SwapReceipt | undefined> => {
    if (!swapCallback || !trade || !fromAsset || !toAsset) {
      throw new SwapFlowStop('QUOTE_UNAVAILABLE');
    }
    // The quote on screen can be a refresh old; check it still holds.
    if (!(await refreshQuote())) throw new SwapFlowStop('PRICE_CHANGED');
    const transaction = await swapCallback();
    if (!transaction?.transactionHash) return undefined;
    return {
      kind: 'completed',
      fromAmount: typed,
      fromName: assetDisplayName(fromAsset),
      toAmount: Number(trade.outputAmount.toExact()),
      toName: assetDisplayName(toAsset),
      toAsset,
      feeUsd: feeUsd ?? undefined,
      completedAt: Date.now(),
      transactionHash: transaction.transactionHash,
      fromChainId: fuse.id,
      toChainId: fuse.id,
    };
  }, [swapCallback, trade, fromAsset, toAsset, refreshQuote, typed, feeUsd]);

  return {
    route: 'fuse',
    isLegacyPair,
    fromAsset,
    toAsset,
    fromBalance,
    maxValue: maxOf(fromAsset, fromBalance),
    typedValue,
    toAmount,
    fromUsd: usdAt(typed, fromAsset),
    toUsd: usdAt(toAmount, toAsset),
    rate: toAmount !== undefined && typed > 0 ? toAmount / typed : undefined,
    feeUsd: trade ? feeUsd : undefined,
    feePercentage: trade ? swapFee.rate : undefined,
    feeFootnote: swapFee.rate > 0 ? swapFeeFootnote(tierName) : undefined,
    etaSeconds: trade ? 0 : undefined,
    isCrossChain: false,
    isQuoting,
    error,
    canReview: !!typedValue && !!trade && !isQuoting && !error && !!swapCallback && !isLegacyPair,
    isSending,
    recheck,
    execute,
  };
}
