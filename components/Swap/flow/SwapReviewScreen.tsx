import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';
import { Image } from 'expo-image';
import { RefreshCw } from 'lucide-react-native';
import { useShallow } from 'zustand/react/shallow';

import { DetailCard } from '@/components/Send/CrossChain/shared';
import { swapDetailRows } from '@/components/Swap/flow/SwapDetailsCard';
import SwapAssetLogo from '@/components/Swap/SwapAssetLogo';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { CHAIN_NAMES } from '@/constants/chains';
import { SWAP_MODAL } from '@/constants/modals';
import { TRACKING_EVENTS } from '@/constants/tracking-events';
import { SwapFlowStop, useSwapFlow } from '@/hooks/swap/useSwapFlow';
import useUser from '@/hooks/useUser';
import { track } from '@/lib/analytics';
import { LifiSwapApiError } from '@/lib/api/lifi-swap';
import { getAsset } from '@/lib/assets';
import { sanitizeTechnicalMessage, showFailureSheet } from '@/lib/errors';
import { assetDisplayName } from '@/lib/swapAssets';
import { swapErrorCodeOf, swapErrorCopy } from '@/lib/swapErrors';
import { SwapAsset } from '@/lib/types/lifi-swap';
import { formatSwapAmount, formatSwapUsd } from '@/lib/utils/swap/format';
import { useSwapState } from '@/store/swapStore';
import { selectedRewardsUserId, useRewardsUpgradeStore } from '@/store/useRewardsUpgradeStore';

/** A move under this share of what's shown isn't worth telling anyone about. */
const PRICE_MOVE_NOTICE = 0.001;

const SideRow = ({
  label,
  asset,
  amount,
  usd,
}: {
  label: string;
  asset: SwapAsset | undefined;
  amount: string;
  usd: number | undefined;
}) => (
  <View className="flex-row items-center gap-[13px] px-[18px] py-[14px]">
    <SwapAssetLogo asset={asset} size={36} />
    <View className="flex-1 gap-0.5">
      <Text className="text-sm leading-[18px] text-white/60">{label}</Text>
      <Text className="text-lg font-semibold leading-[22px] text-white">{amount}</Text>
    </View>
    <Text className="text-sm text-white/60">{usd !== undefined ? formatSwapUsd(usd) : ''}</Text>
  </View>
);

/**
 * Screen 4 of the swap: the numbers to confirm. The price keeps re-checking
 * every 30 seconds underneath, and once more before the signature; a move is
 * said out loud rather than swapped in silently.
 */
const SwapReviewScreen: React.FC = () => {
  const model = useSwapFlow();
  const { user } = useUser();
  const { setModal, setReceipt } = useSwapState(
    useShallow(state => ({
      setModal: state.actions.setModal,
      setReceipt: state.actions.setReceipt,
    })),
  );
  const [stopped, setStopped] = useState<string>();
  const executing = useRef(false);
  /** Set once the swap went through, so nothing sends the screen back to the form. */
  const finished = useRef(false);
  const { fromAsset, toAsset, typedValue, toAmount, isSending } = model;
  const fromName = fromAsset ? assetDisplayName(fromAsset) : '';
  const toName = toAsset ? assetDisplayName(toAsset) : '';

  // What the screen opened on, so a re-check that moves the price is noticed.
  const reviewed = useRef(toAmount);
  const [priceMoved, setPriceMoved] = useState(false);
  useEffect(() => {
    if (toAmount === undefined) return;
    if (reviewed.current === undefined) {
      reviewed.current = toAmount;
      return;
    }
    if (Math.abs(toAmount - reviewed.current) / reviewed.current > PRICE_MOVE_NOTICE) {
      setPriceMoved(true);
      reviewed.current = toAmount;
    }
  }, [toAmount]);

  // Back to the form if the amount stops being swappable while this is open
  // (the balance dropped, the route went away). Not mid-swap, and not after.
  useEffect(() => {
    if (finished.current || executing.current || isSending) return;
    if (!typedValue || model.error) setModal(SWAP_MODAL.OPEN_FORM);
  }, [typedValue, model.error, isSending, setModal]);

  const trackingProps = useMemo(
    () => ({
      user_id: user?.userId,
      safe_address: user?.safeAddress,
      trade_type: model.route === 'fuse' ? 'standard' : model.route,
      flow: 'new',
      input_currency: fromAsset?.symbol,
      output_currency: toAsset?.symbol,
      from_chain_id: fromAsset?.chainId,
      to_chain_id: toAsset?.chainId,
      input_amount: typedValue,
      output_amount: toAmount,
    }),
    [user?.userId, user?.safeAddress, model.route, fromAsset, toAsset, typedValue, toAmount],
  );
  const handleSwapRef = useRef<() => Promise<void>>(async () => {});

  const handleSwap = useCallback(async () => {
    if (executing.current) return;
    executing.current = true;
    setStopped(undefined);
    const session = useRewardsUpgradeStore.getState().session;
    const sameAccount = () =>
      selectedRewardsUserId() === user?.userId &&
      useRewardsUpgradeStore.getState().session === session;
    track(TRACKING_EVENTS.SWAP_INITIATED, trackingProps);
    try {
      const receipt = await model.execute();
      if (!receipt || !sameAccount()) return;
      track(TRACKING_EVENTS.SWAP_COMPLETED, {
        ...trackingProps,
        output_amount: receipt.toAmount,
        cross_chain: receipt.kind === 'bridging',
      });
      // The amount stays typed until the outcome screen is left, so this
      // screen never sees an empty form and sends itself back to it.
      finished.current = true;
      setReceipt(receipt);
      setModal(receipt.kind === 'bridging' ? SWAP_MODAL.OPEN_ON_ITS_WAY : SWAP_MODAL.OPEN_SWAPPED);
    } catch (error) {
      if (error instanceof SwapFlowStop) {
        setStopped(swapErrorCopy(error.code));
        setPriceMoved(false);
        return;
      }
      track(TRACKING_EVENTS.SWAP_FAILED, {
        ...trackingProps,
        // The raw message carries the bundler URL and its API key.
        error: sanitizeTechnicalMessage(error),
        error_code: error instanceof LifiSwapApiError ? swapErrorCodeOf(error) : 'SWAP_FAILED',
      });
      if (sameAccount()) {
        void showFailureSheet(error, {
          action: 'swap',
          retryLabel: 'Try again',
          onRetry: () => void handleSwapRef.current(),
          details: {
            amount: typedValue,
            token: fromAsset?.symbol,
            network: fromAsset ? CHAIN_NAMES[fromAsset.chainId] : undefined,
          },
        });
      }
    } finally {
      executing.current = false;
    }
  }, [model, user?.userId, trackingProps, setReceipt, setModal, fromAsset, typedValue]);

  useEffect(() => {
    handleSwapRef.current = handleSwap;
  }, [handleSwap]);

  const ready = model.canReview && !model.isQuoting;

  return (
    <View className="flex-1 justify-between gap-8">
      <View className="gap-4">
        <View className="overflow-hidden rounded-[15px] bg-card">
          <SideRow
            label="You pay"
            asset={fromAsset}
            amount={`${formatSwapAmount(Number(typedValue) || 0)} ${fromName}`}
            usd={model.fromUsd}
          />
          <View className="h-px bg-white/10" />
          <SideRow
            label="You get"
            asset={toAsset}
            amount={toAmount !== undefined ? `${formatSwapAmount(toAmount)} ${toName}` : '…'}
            usd={model.toUsd}
          />
        </View>

        <DetailCard rows={swapDetailRows(model)} />

        {model.notice ? (
          <Text className="px-1 text-sm leading-5 text-white/60">{model.notice}</Text>
        ) : null}

        {priceMoved || stopped ? (
          <View className="flex-row gap-2 rounded-[15px] bg-[rgba(148,242,127,0.12)] px-4 py-3">
            <RefreshCw size={16} color="#94f27f" />
            <Text className="flex-1 text-sm leading-5 text-brand">
              {stopped ?? 'The price changed. Check the new amount before you swap.'}
            </Text>
          </View>
        ) : null}

        <Text className="px-1 text-sm leading-5 text-white/60">
          Swaps can’t be undone. We re-check the price every 30 seconds and tell you if it changes.
        </Text>
      </View>

      <Button
        variant="brand"
        className="h-12 rounded-full"
        size="lg"
        disabled={!ready || isSending}
        onPress={handleSwap}
      >
        {isSending ? (
          <Text className="text-base font-bold">Swapping…</Text>
        ) : !ready ? (
          <Text className="text-base font-bold">Getting price…</Text>
        ) : (
          <View className="flex-row items-center gap-2">
            <Image source={getAsset('images/security_key.png')} style={{ width: 21, height: 10 }} />
            <Text className="text-base font-bold">
              Swap {formatSwapAmount(Number(typedValue) || 0)} {fromName}
            </Text>
          </View>
        )}
      </Button>
    </View>
  );
};

export default SwapReviewScreen;
