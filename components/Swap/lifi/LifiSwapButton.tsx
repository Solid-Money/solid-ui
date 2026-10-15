import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';
import { Image } from 'expo-image';
import * as Sentry from '@sentry/react-native';
import { Address, formatUnits } from 'viem';
import { useShallow } from 'zustand/react/shallow';

import InfoError from '@/assets/images/info-error';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { CHAIN_NAMES } from '@/constants/chains';
import { SWAP_MODAL } from '@/constants/modals';
import { TRACKING_EVENTS } from '@/constants/tracking-events';
import { NetworkFeeNotSponsoredError, useLifiSwapCallback } from '@/hooks/swap/useLifiSwapCallback';
import { useLifiSwapInfo } from '@/hooks/swap/useLifiSwapInfo';
import useUser from '@/hooks/useUser';
import { track } from '@/lib/analytics';
import { getAsset } from '@/lib/assets';
import { getUserErrorMessage } from '@/lib/errors/classify';
import { sanitizeTechnicalMessage } from '@/lib/errors/sanitize';
import { lifiPriceImpact } from '@/lib/utils/swap/lifi';
import { warningSeverity } from '@/lib/utils/swap/prices';
import { getChain } from '@/lib/wagmi';
import { useSwapState } from '@/store/swapStore';
import { selectedRewardsUserId, useRewardsUpgradeStore } from '@/store/useRewardsUpgradeStore';
import { useUserState } from '@/store/userStore';

const LifiSwapButton: React.FC = () => {
  const executing = useRef(false);
  const operationSession = useRef<number | undefined>(undefined);
  const [submissionError, setSubmissionError] = useState<string>();
  const { isExpertMode } = useUserState();
  const { user } = useUser();

  const { typedValue, resetForm, setModal, setTransaction } = useSwapState(
    useShallow(state => ({
      typedValue: state.typedValue,
      resetForm: state.actions.resetForm,
      setModal: state.actions.setModal,
      setTransaction: state.actions.setTransaction,
    })),
  );
  const {
    fromAsset,
    toAsset,
    quote,
    isQuoting,
    quoteError,
    inputError,
    refreshQuote,
    paysNetworkFee,
    setNetworkFeeNotSponsored,
  } = useLifiSwapInfo();
  const { swap, isSending } = useLifiSwapCallback();

  useEffect(() => {
    setSubmissionError(undefined);
  }, [typedValue, fromAsset, toAsset, user?.userId]);

  // No USD figure means no impact figure; don't block on it.
  const priceImpact = lifiPriceImpact(quote);
  const severity = priceImpact ? warningSeverity(priceImpact) : 0;
  const priceImpactTooHigh = severity > 3 && !isExpertMode;

  const trackingProps = useMemo(
    () => ({
      user_id: user?.userId,
      safe_address: user?.safeAddress,
      trade_type: 'lifi',
      input_currency: fromAsset?.symbol,
      output_currency: toAsset?.symbol,
      from_chain_id: fromAsset?.chainId,
      to_chain_id: toAsset?.chainId,
      input_amount: typedValue,
    }),
    [user?.userId, user?.safeAddress, fromAsset, toAsset, typedValue],
  );

  const handleSwap = useCallback(async () => {
    if (executing.current || !quote) return;
    executing.current = true;
    setSubmissionError(undefined);
    operationSession.current = useRewardsUpgradeStore.getState().session;

    try {
      // The quote on screen can be a refresh old, and LI.FI's calldata expires.
      // Sign the fresh one, unless it now pays less than the old one promised.
      const fresh = await refreshQuote();
      if (!fresh) {
        Sentry.addBreadcrumb({
          message: 'LI.FI quote moved before signing',
          category: 'swap',
          level: 'info',
        });
        setSubmissionError('The price changed. Check the new amount and swap again.');
        return;
      }

      track(TRACKING_EVENTS.SWAP_INITIATED, {
        ...trackingProps,
        output_amount: formatUnits(BigInt(fresh.toAmount), fresh.toToken.decimals),
        route: fresh.steps.map(step => step.tool).join('>'),
        solid_fee_percentage: fresh.solidFee.percentage,
        network_fee: paysNetworkFee ? 'user' : 'sponsored',
      });

      const result = await swap(fresh, { payNetworkFee: paysNetworkFee });
      if (result.kind === 'cancelled') return;

      track(TRACKING_EVENTS.SWAP_COMPLETED, {
        ...trackingProps,
        output_amount: formatUnits(BigInt(fresh.toAmount), fresh.toToken.decimals),
        cross_chain: result.kind === 'bridging',
        network_fee: paysNetworkFee ? 'user' : 'sponsored',
      });

      if (
        selectedRewardsUserId() !== user?.userId ||
        operationSession.current !== useRewardsUpgradeStore.getState().session
      )
        return;

      resetForm();
      if (result.kind === 'bridging') {
        setModal(SWAP_MODAL.OPEN_LIFI_STATUS);
        return;
      }
      setTransaction({
        amount: Number(formatUnits(BigInt(fresh.fromAmount), fresh.fromToken.decimals)),
        address: fresh.fromToken.address as Address,
        inputCurrencySymbol: fresh.fromToken.symbol,
        outputCurrencySymbol: fresh.toToken.symbol,
        transactionHash: result.transactionHash,
        chainId: fresh.fromChainId,
      });
      setModal(SWAP_MODAL.OPEN_TRANSACTION_STATUS);
    } catch (error: any) {
      const sameAccount =
        selectedRewardsUserId() === user?.userId &&
        operationSession.current === useRewardsUpgradeStore.getState().session;

      // Not a failure to show as one: the form now offers to pay the fee.
      if (error instanceof NetworkFeeNotSponsoredError) {
        track(TRACKING_EVENTS.SWAP_FAILED, {
          ...trackingProps,
          error: 'network_fee_not_sponsored',
        });
        if (sameAccount) setNetworkFeeNotSponsored(error.chainId);
        return;
      }

      console.error('LI.FI swap failed:', error);
      // The raw message carries the bundler URL and its API key.
      track(TRACKING_EVENTS.SWAP_FAILED, {
        ...trackingProps,
        error: sanitizeTechnicalMessage(error),
        network_fee: paysNetworkFee ? 'user' : 'sponsored',
      });
      if (sameAccount) {
        // viem's shortMessage ("Invalid parameters were provided to the RPC
        // method") is SDK text; the screen gets user copy.
        setSubmissionError(
          getUserErrorMessage(error, { action: 'swap' }) ||
            'Unable to complete the swap. Please try again.',
        );
      }
    } finally {
      executing.current = false;
    }
  }, [
    quote,
    refreshQuote,
    swap,
    resetForm,
    setModal,
    setTransaction,
    user?.userId,
    trackingProps,
    paysNetworkFee,
    setNetworkFeeNotSponsored,
  ]);

  const sourceChain = fromAsset ? getChain(fromAsset.chainId) : undefined;
  const nativeSymbol = sourceChain?.nativeCurrency.symbol ?? 'gas token';
  const networkName = fromAsset ? (CHAIN_NAMES[fromAsset.chainId] ?? sourceChain?.name) : undefined;

  const errorMessage =
    inputError ||
    quoteError ||
    (priceImpactTooHigh ? 'Price Impact Too High' : undefined) ||
    submissionError;
  // Shown until something else needs saying; the button below then reads
  // "Pay fee & swap", so the person opts into paying before any passkey prompt.
  const networkFeeNotice =
    paysNetworkFee && !errorMessage
      ? `We can’t cover the ${networkName ? `${networkName} ` : ''}network fee for this swap right now. You can pay it from your ${nativeSymbol} instead.`
      : undefined;

  const isDisabled = Boolean(
    !!inputError || !!quoteError || !quote || isQuoting || isSending || priceImpactTooHigh,
  );

  return (
    <View>
      {errorMessage && typedValue ? <ErrorMessage message={errorMessage} /> : null}
      {networkFeeNotice && typedValue ? <Notice message={networkFeeNotice} /> : null}
      <Button
        className="rounded-xl"
        variant="brand"
        size="lg"
        onPress={handleSwap}
        disabled={isDisabled}
      >
        {isSending ? (
          <Text className="text-base font-bold">Processing Transaction...</Text>
        ) : !typedValue ? (
          <Text className="text-base font-bold">Enter an amount</Text>
        ) : isQuoting ? (
          <Text className="text-base font-bold">Finding Routes...</Text>
        ) : severity > 2 && !priceImpactTooHigh ? (
          <Text className="text-base font-bold">Swap Anyway</Text>
        ) : (
          <View className="flex-row items-center gap-2">
            <Image source={getAsset('images/security_key.png')} style={{ width: 21, height: 10 }} />
            <Text className="text-base font-bold">
              {paysNetworkFee ? 'Pay fee & swap' : 'Swap'}
            </Text>
          </View>
        )}
      </Button>
    </View>
  );
};

const ErrorMessage = ({ message }: { message: string }) => (
  <View className="mb-3 flex-row items-center gap-2">
    <InfoError />
    <Text className="flex-shrink text-sm text-red-400">{message}</Text>
  </View>
);

const Notice = ({ message }: { message: string }) => (
  <View className="mb-3 flex-row items-center gap-2">
    <InfoError />
    <Text className="flex-shrink text-sm text-yellow-400">{message}</Text>
  </View>
);

export default LifiSwapButton;
