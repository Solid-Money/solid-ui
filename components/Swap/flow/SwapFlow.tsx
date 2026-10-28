import React from 'react';
import { View } from 'react-native';

import SwapAssetPicker from '@/components/Swap/flow/SwapAssetPicker';
import SwapFormScreen from '@/components/Swap/flow/SwapFormScreen';
import { SwapOnItsWayScreen, SwapSwappedScreen } from '@/components/Swap/flow/SwapOutcomeScreens';
import SwapReviewScreen from '@/components/Swap/flow/SwapReviewScreen';
import SwapButton from '@/components/Swap/SwapButton';
import SwapPair from '@/components/Swap/SwapPair';
import SwapParams from '@/components/Swap/SwapParams';
import { SWAP_MODAL } from '@/constants/modals';
import { SwapFlowProvider, useSwapFlow } from '@/hooks/swap/useSwapFlow';
import { useSwapState } from '@/store/swapStore';

/** The modal states the new flow draws, in the order a swap goes through them. */
export const SWAP_FLOW_STATES: readonly string[] = [
  SWAP_MODAL.OPEN_FORM.name,
  SWAP_MODAL.OPEN_PAY_PICKER.name,
  SWAP_MODAL.OPEN_GET_PICKER.name,
  SWAP_MODAL.OPEN_REVIEW.name,
  SWAP_MODAL.OPEN_SWAPPED.name,
  SWAP_MODAL.OPEN_ON_ITS_WAY.name,
];

const SwapFlowStep = ({ name }: { name: string }) => {
  const { isLegacyPair } = useSwapFlow();

  if (name === SWAP_MODAL.OPEN_PAY_PICKER.name) return <SwapAssetPicker side="pay" />;
  if (name === SWAP_MODAL.OPEN_GET_PICKER.name) return <SwapAssetPicker side="get" />;
  if (name === SWAP_MODAL.OPEN_REVIEW.name) return <SwapReviewScreen />;

  // Wrapping FUSE and migrating a pegged coin aren't swaps; the old Fuse form
  // still does those, inside the same quote provider.
  if (isLegacyPair) {
    return (
      <View className="flex flex-col gap-4">
        <SwapPair />
        <SwapParams />
        <View className="mt-2">
          <SwapButton />
        </View>
      </View>
    );
  }
  return <SwapFormScreen />;
};

/**
 * The redesigned swap, screen by screen. The quote provider wraps every screen
 * up to the signature, so the price on the form is the one the review shows;
 * the outcome screens read the receipt and need none.
 */
const SwapFlow = () => {
  const name = useSwapState(state => state.currentModal.name);

  if (name === SWAP_MODAL.OPEN_SWAPPED.name) return <SwapSwappedScreen />;
  if (name === SWAP_MODAL.OPEN_ON_ITS_WAY.name) return <SwapOnItsWayScreen />;
  return (
    <SwapFlowProvider>
      <SwapFlowStep name={name} />
    </SwapFlowProvider>
  );
};

export default SwapFlow;
