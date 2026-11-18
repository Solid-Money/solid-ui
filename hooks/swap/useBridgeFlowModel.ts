import { useCallback, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Address, formatUnits } from 'viem';
import { useShallow } from 'zustand/react/shallow';

import { CHAIN_NAMES } from '@/constants/chains';
import { SolidBridgeRoute } from '@/constants/swapChains';
import { SwapFlowError, SwapFlowModel, SwapFlowStop } from '@/hooks/swap/swapFlowTypes';
import { toBaseUnits } from '@/hooks/swap/useLifiSwapInfo';
import { SWAP_PRICE_RECHECK_MS, useQuoteInput } from '@/hooks/swap/useQuoteInput';
import { findSwapAsset, useSwapAssets } from '@/hooks/swap/useSwapAssets';
import { useActivityActions } from '@/hooks/useActivityActions';
import useUser from '@/hooks/useUser';
import {
  authoriseCrossChainSend,
  CrossChainSendApiError,
  fetchCrossChainSendQuote,
} from '@/lib/api/cross-chain-send';
import { UserCopyError } from '@/lib/errors/UserCopyError';
import { executeTransactions, USER_CANCELLED_TRANSACTION } from '@/lib/execute';
import { assetDisplayName, assetIdentity } from '@/lib/swapAssets';
import { bridgeAmount, bridgeQuoteError } from '@/lib/swapBridge';
import { swapErrorCopy } from '@/lib/swapErrors';
import { TransactionType } from '@/lib/types';
import { CrossChainSendQuote } from '@/lib/types/cross-chain-send';
import { SwapAsset, SwapAssetWithBalance } from '@/lib/types/lifi-swap';
import { SwapField } from '@/lib/types/swap-field';
import { withRefreshToken } from '@/lib/utils';
import { OWN_WALLET } from '@/lib/utils/cross-chain-send';
import { buildCrossChainSendCalls } from '@/lib/utils/cross-chain-send-calls';
import { getChain } from '@/lib/wagmi';
import { SwapReceipt, useSwapState } from '@/store/swapStore';
import { selectedRewardsUserId, useRewardsUpgradeStore } from '@/store/useRewardsUpgradeStore';

const priceOf = (asset: SwapAsset | undefined) =>
  asset && 'priceUsd' in asset ? (asset as SwapAssetWithBalance).priceUsd : 0;

/** USDC and USDT stand in at a dollar when the wallet has no price for them. */
const dollarOr = (asset: SwapAsset | undefined) =>
  priceOf(asset) || (asset && assetIdentity(asset).category === 'stablecoins' ? 1 : 0);

/**
 * The swap form for USDC or USDT moving as itself between Fuse and Ethereum,
 * Base or BNB Chain (`solidBridgeRoute`): a cross-chain send from the user's
 * Safe to itself on the other network, its fee taken from the coin by the
 * sending network's BridgePaymaster.
 */
export function useBridgeFlowModel(route: SolidBridgeRoute): SwapFlowModel {
  const { user, safeAA } = useUser();
  const { trackTransaction } = useActivityActions();
  const queryClient = useQueryClient();
  const [isSending, setIsSending] = useState(false);
  const { input, output, typedValue } = useSwapState(
    useShallow(state => ({
      input: state[SwapField.INPUT],
      output: state[SwapField.OUTPUT],
      typedValue: state.typedValue,
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

  const fromName = fromAsset ? assetDisplayName(fromAsset) : '';
  const toName = toAsset ? assetDisplayName(toAsset) : '';
  const dstName = CHAIN_NAMES[route.dstChainId] ?? 'the other network';

  const fromBalance =
    fromAsset && 'balanceRaw' in fromAsset
      ? (fromAsset as SwapAssetWithBalance).balanceRaw
      : assetsLoading
        ? undefined
        : 0n;
  const fromAmount = useMemo(() => toBaseUnits(typedValue, fromAsset), [typedValue, fromAsset]);

  // Quote what's typed once typing pauses.
  const quoteInput = useQuoteInput(SwapField.INPUT, typedValue);
  const amountToQuote = useMemo(
    () => toBaseUnits(quoteInput.typedValue, fromAsset),
    [quoteInput.typedValue, fromAsset],
  );
  const canQuote = !!user && !!fromAsset && !!toAsset && !!amountToQuote;
  const queryKey = useMemo(
    () => [
      'swap-bridge-quote',
      route.srcChainId,
      route.dstChainId,
      route.token,
      amountToQuote?.toString(),
    ],
    [route.srcChainId, route.dstChainId, route.token, amountToQuote],
  );

  const {
    data: quote,
    error: quoteFailure,
    isFetching,
    refetch,
  } = useQuery({
    queryKey,
    enabled: canQuote,
    queryFn: () =>
      withRefreshToken(() =>
        fetchCrossChainSendQuote({
          srcChainId: route.srcChainId,
          token: route.token,
          dstChainId: route.dstChainId,
          amountLD: amountToQuote!.toString(),
        }),
      ) as Promise<CrossChainSendQuote>,
    refetchInterval: SWAP_PRICE_RECHECK_MS,
    staleTime: SWAP_PRICE_RECHECK_MS / 2,
    // A minimum or a limit won't change on retry; a busy route might.
    retry: (count, err) =>
      !(err instanceof CrossChainSendApiError && err.status < 500) && count < 2,
  });

  const isQuoting = canQuote && (quoteInput.pending || (isFetching && !quote));
  const sentDecimals = fromAsset?.decimals ?? 6;
  const toAmount =
    quote && !isQuoting ? bridgeAmount(quote.amountReceivedLD, quote, sentDecimals) : undefined;

  const typed = Number(typedValue) || 0;
  const fromPrice = dollarOr(fromAsset);
  const feeUsd = useMemo(() => {
    if (!quote) return { usd: undefined, percentage: undefined };
    const fee = bridgeAmount(quote.totalFeeLD, quote, sentDecimals);
    const sent = bridgeAmount(quote.amountLD, quote, sentDecimals);
    return {
      usd: fromPrice > 0 ? fee * fromPrice : null,
      percentage: sent > 0 ? fee / sent : null,
    };
  }, [quote, sentDecimals, fromPrice]);

  const error = useMemo((): SwapFlowError | undefined => {
    if (!typedValue) return undefined;
    if (fromBalance !== undefined && fromAmount !== undefined && fromBalance < fromAmount) {
      return {
        code: 'NOT_ENOUGH_BALANCE',
        copy: swapErrorCopy('NOT_ENOUGH_BALANCE', { from: fromName }),
      };
    }
    if (canQuote && quoteFailure && !quoteInput.pending) return bridgeQuoteError(quoteFailure);
    return undefined;
  }, [typedValue, fromBalance, fromAmount, canQuote, quoteFailure, quoteInput.pending, fromName]);

  const recheck = useCallback(async () => {
    const { data: fresh, isError } = await refetch();
    return !isError && !!fresh;
  }, [refetch]);

  const execute = useCallback(async (): Promise<SwapReceipt | undefined> => {
    if (!quote || !fromAsset || !toAsset) throw new SwapFlowStop('QUOTE_UNAVAILABLE');
    if (!user?.safeAddress || !user.suborgId || !user.signWith)
      throw new UserCopyError('Your wallet is not ready. Reopen the swap and try again.');
    const chain = getChain(route.srcChainId);
    if (!chain) throw new UserCopyError('This network is not supported for swaps yet.');

    const accountSession = useRewardsUpgradeStore.getState().session;
    const assertAccount = async () => {
      if (
        selectedRewardsUserId() !== user.userId ||
        useRewardsUpgradeStore.getState().session !== accountSession
      )
        throw new UserCopyError('Account changed. Reopen the swap for the selected account.');
    };

    const safe = user.safeAddress as Address;
    setIsSending(true);
    try {
      // The backend re-prices and sends a new quote back rather than sign a
      // worse one than the screen shows.
      const authorised = await withRefreshToken(() =>
        authoriseCrossChainSend({
          srcChainId: route.srcChainId,
          token: route.token,
          dstChainId: route.dstChainId,
          recipient: safe,
          exchange: OWN_WALLET,
          amountLD: quote.amountLD,
          expectedAmountReceivedLD: quote.amountReceivedLD,
          quoteId: quote.quoteId,
        }),
      );
      if (authorised.status === 'requote') {
        queryClient.setQueryData(queryKey, authorised.quote);
        throw new SwapFlowStop('PRICE_CHANGED');
      }

      const { send } = authorised;
      const sent = formatUnits(BigInt(send.voucher.amountLD), sentDecimals);
      const smartAccountClient = await safeAA(chain, user.suborgId, user.signWith);
      const result = await trackTransaction(
        {
          type: TransactionType.CROSS_CHAIN_SEND,
          // The backend's tracker finds the activity by the send's id.
          clientTxId: send.sendId,
          title: `Move ${route.token} to ${dstName}`,
          shortTitle: `${route.token} → ${dstName}`,
          amount: sent,
          symbol: route.token,
          chainId: route.srcChainId,
          fromAddress: safe,
          toAddress: safe,
          metadata: {
            description: `Move ${sent} ${route.token} from ${CHAIN_NAMES[route.srcChainId]} to ${dstName}`,
            tokenAddress: send.tokenAddress,
            tokenDecimals: String(sentDecimals),
            dstChainId: route.dstChainId,
            exchange: OWN_WALLET,
            sendId: send.sendId,
            feeLD: send.quote.feeLD,
            bridgeFeeLD: send.quote.bridgeFeeLD,
            amountReceivedLD: send.quote.amountReceivedLD,
            minAmountLD: send.quote.minAmountLD,
          },
        },
        onUserOpHash =>
          executeTransactions(
            smartAccountClient,
            buildCrossChainSendCalls(send),
            'Swap failed',
            chain,
            onUserOpHash,
            assertAccount,
          ),
      );

      if (result === USER_CANCELLED_TRANSACTION) return undefined;
      const { transaction, transactionHash } = result;
      if (!transactionHash || transaction?.status !== 'success')
        throw new Error('Swap has not been confirmed');

      queryClient.invalidateQueries({ queryKey: ['balance'] });
      queryClient.invalidateQueries({ queryKey: ['tokenBalances'] });
      queryClient.invalidateQueries({ queryKey: ['swap-fuse-balances'] });

      return {
        kind: 'bridging',
        fromAmount: Number(sent),
        fromName,
        toAmount: bridgeAmount(send.quote.amountReceivedLD, send.quote, sentDecimals),
        toName,
        toAsset,
        feeUsd: feeUsd.usd ?? undefined,
        completedAt: Date.now(),
        transactionHash,
        fromChainId: route.srcChainId,
        toChainId: route.dstChainId,
        clientTxId: send.sendId,
        bridge: { sendId: send.sendId, sentDecimals },
      };
    } catch (error: any) {
      if (error === USER_CANCELLED_TRANSACTION) return undefined;
      const message = error?.message?.toLowerCase() || '';
      if (
        message.includes('user cancelled') ||
        message.includes('user denied') ||
        message.includes('user rejected')
      )
        return undefined;
      throw error;
    } finally {
      setIsSending(false);
    }
  }, [
    quote,
    fromAsset,
    toAsset,
    user,
    route,
    safeAA,
    trackTransaction,
    queryClient,
    queryKey,
    sentDecimals,
    dstName,
    fromName,
    toName,
    feeUsd.usd,
  ]);

  return {
    route: 'bridge',
    isLegacyPair: false,
    fromAsset,
    toAsset,
    fromBalance,
    // Gas is sponsored and the bridge's fee comes out of the amount, so all of it can go.
    maxValue: fromAsset && fromBalance ? formatUnits(fromBalance, fromAsset.decimals) : undefined,
    typedValue,
    toAmount,
    fromUsd: fromPrice > 0 ? typed * fromPrice : undefined,
    toUsd: toAmount !== undefined ? toAmount * dollarOr(toAsset) || undefined : undefined,
    rate: toAmount !== undefined && typed > 0 ? toAmount / typed : undefined,
    feeUsd: feeUsd.usd,
    feePercentage: feeUsd.percentage,
    feeFootnote: undefined,
    etaSeconds: quote ? quote.etaMinutes * 60 : undefined,
    isCrossChain: true,
    isQuoting,
    error,
    canReview: !!typedValue && !!quote && !isQuoting && !error && toAmount !== undefined,
    isSending,
    recheck,
    execute,
  };
}
