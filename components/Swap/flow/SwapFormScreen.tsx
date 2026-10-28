import React, { useCallback, useEffect, useRef } from 'react';
import { Pressable, View } from 'react-native';
import { ArrowUpDown, CircleAlert } from 'lucide-react-native';
import { useShallow } from 'zustand/react/shallow';

import SwapAmountCard from '@/components/Swap/flow/SwapAmountCard';
import SwapDetailsCard from '@/components/Swap/flow/SwapDetailsCard';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { SWAP_MODAL } from '@/constants/modals';
import { TRACKING_EVENTS } from '@/constants/tracking-events';
import { useSwapFlow } from '@/hooks/swap/useSwapFlow';
import { track } from '@/lib/analytics';
import { assetDisplayName } from '@/lib/swapAssets';
import { swapErrorButtonLabel } from '@/lib/swapErrors';
import { SwapAsset, SwapAssetWithBalance } from '@/lib/types/lifi-swap';
import { SwapField } from '@/lib/types/swap-field';
import { formatSwapAmount, sanitizeAmountInput } from '@/lib/utils/swap/format';
import { useSwapActionHandlers, useSwapState } from '@/store/swapStore';

/** Errors the button can fix by opening the "You get" picker. */
const PICK_ANOTHER = new Set(['NO_ROUTE', 'TOKEN_NOT_SWAPPABLE', 'SAME_TOKEN']);

const balanceOf = (asset: SwapAsset | undefined): number | undefined =>
  asset && 'balance' in asset ? (asset as SwapAssetWithBalance).balance : undefined;

/**
 * Screen 1 of the swap: what you pay, what you get, and what it costs. One
 * form for every pair; Fuse pairs price on Algebra, the rest on LI.FI.
 */
const SwapFormScreen: React.FC = () => {
  const model = useSwapFlow();
  const { onSwitchTokens, onUserInput } = useSwapActionHandlers();
  const { setModal } = useSwapState(useShallow(state => ({ setModal: state.actions.setModal })));
  const { fromAsset, toAsset, typedValue, error, isQuoting } = model;

  const fromName = fromAsset ? assetDisplayName(fromAsset) : '';
  const toName = toAsset ? assetDisplayName(toAsset) : '';

  const handleChangeText = useCallback(
    (text: string) => onUserInput(SwapField.INPUT, sanitizeAmountInput(text, fromAsset?.decimals)),
    [onUserInput, fromAsset?.decimals],
  );
  const handleMax = useCallback(() => {
    if (model.maxValue) onUserInput(SwapField.INPUT, model.maxValue);
  }, [model.maxValue, onUserInput]);

  const openPicker = useCallback(
    (side: 'pay' | 'get') => {
      track(TRACKING_EVENTS.SWAP_TOKEN_SELECTOR_OPENED, {
        field: side,
        current_currency: (side === 'pay' ? fromAsset : toAsset)?.symbol,
        current_chain_id: (side === 'pay' ? fromAsset : toAsset)?.chainId,
        flow: 'new',
      });
      setModal(side === 'pay' ? SWAP_MODAL.OPEN_PAY_PICKER : SWAP_MODAL.OPEN_GET_PICKER);
    },
    [fromAsset, toAsset, setModal],
  );

  const startedTyping = useRef(false);
  useEffect(() => {
    if (!typedValue || startedTyping.current) return;
    startedTyping.current = true;
    track(TRACKING_EVENTS.SWAP_AMOUNT_ENTRY_STARTED, {
      field: 'pay',
      currency_symbol: fromAsset?.symbol,
      flow: 'new',
    });
  }, [typedValue, fromAsset?.symbol]);

  const fromBalance = balanceOf(fromAsset);
  const toBalance = balanceOf(toAsset);
  const notEnough = error?.code === 'NOT_ENOUGH_BALANCE';
  const noRoute = error?.code === 'NO_ROUTE';
  const showBanner = !!error && !notEnough;
  const showDetails = !!typedValue && model.toAmount !== undefined && !error;

  const getValue =
    !typedValue || isQuoting
      ? ''
      : noRoute
        ? '—'
        : model.toAmount !== undefined
          ? formatSwapAmount(model.toAmount)
          : '';

  const button = (() => {
    if (!typedValue) return { label: 'Enter an amount', disabled: true };
    if (isQuoting) return { label: 'Getting price…', disabled: true };
    if (error && PICK_ANOTHER.has(error.code)) {
      return { label: 'Pick another coin', disabled: false, onPress: () => openPicker('get') };
    }
    if (error) {
      return { label: swapErrorButtonLabel(error.code, { from: fromName }), disabled: true };
    }
    return {
      label: 'Review',
      disabled: !model.canReview,
      onPress: () => setModal(SWAP_MODAL.OPEN_REVIEW),
    };
  })();

  return (
    <View className="flex-1 justify-between gap-8">
      <View className="gap-2">
        <SwapAmountCard
          label="You pay"
          asset={fromAsset}
          balanceLabel={
            fromBalance !== undefined ? `${formatSwapAmount(fromBalance)} ${fromName}` : undefined
          }
          onMax={model.maxValue && typedValue !== model.maxValue ? handleMax : undefined}
          value={typedValue}
          onChangeText={handleChangeText}
          usd={typedValue ? model.fromUsd : undefined}
          invalid={notEnough}
          onPickAsset={() => openPicker('pay')}
        />
        {notEnough && fromBalance !== undefined ? (
          <Text className="px-1 text-sm text-red-400">
            {`You have ${formatSwapAmount(fromBalance)} ${fromName}`}
          </Text>
        ) : null}

        <View className="z-10 my-1 flex-row items-center justify-center">
          <View className="absolute left-0 right-0 h-px bg-white/10" />
          <Pressable
            onPress={onSwitchTokens}
            accessibilityRole="button"
            accessibilityLabel="Swap what you pay and what you get"
            className="h-9 w-9 items-center justify-center rounded-full bg-brand"
          >
            <ArrowUpDown size={18} color="black" />
          </Pressable>
        </View>

        <SwapAmountCard
          label="You get"
          asset={toAsset}
          balanceLabel={
            toBalance !== undefined ? `${formatSwapAmount(toBalance)} ${toName}` : undefined
          }
          value={getValue}
          pendingLabel={typedValue && isQuoting ? 'Getting price…' : undefined}
          usd={typedValue && !isQuoting && !noRoute ? model.toUsd : undefined}
          onPickAsset={() => openPicker('get')}
        />

        {showBanner ? (
          <View className="mt-3 flex-row gap-2 rounded-[15px] bg-red-500/10 px-4 py-3">
            <CircleAlert size={18} color="#f87171" />
            <Text className="flex-1 text-sm leading-5 text-red-400">{error.copy}</Text>
          </View>
        ) : null}

        {showDetails ? (
          <View className="mt-4">
            <SwapDetailsCard model={model} />
          </View>
        ) : null}
      </View>

      <Button
        variant="brand"
        className="h-12 rounded-full"
        size="lg"
        disabled={button.disabled}
        onPress={button.onPress}
      >
        <Text className="text-base font-bold">{button.label}</Text>
      </Button>
    </View>
  );
};

export default SwapFormScreen;
