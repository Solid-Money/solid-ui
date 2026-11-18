import React, { useEffect } from 'react';
import { View } from 'react-native';

import SwapAssetPicker from '@/components/Swap/flow/SwapAssetPicker';
import SwapFormScreen from '@/components/Swap/flow/SwapFormScreen';
import { SwapOnItsWayScreen, SwapSwappedScreen } from '@/components/Swap/flow/SwapOutcomeScreens';
import SwapReviewScreen from '@/components/Swap/flow/SwapReviewScreen';
import { preloadSwapPickerLogos } from '@/components/Swap/SwapAssetLogo';
import SwapButton from '@/components/Swap/SwapButton';
import SwapPair from '@/components/Swap/SwapPair';
import SwapParams from '@/components/Swap/SwapParams';
import { SWAP_MODAL } from '@/constants/modals';
import { useSwapDestinations } from '@/hooks/swap/useSwapDestinations';
import { SwapFlowProvider, useSwapFlow } from '@/hooks/swap/useSwapFlow';

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
  const { fromAsset, isLegacyPair } = useSwapFlow();
  useEffect(preloadSwapPickerLogos, []);
  const isGetPicker = name === SWAP_MODAL.OPEN_GET_PICKER.name;
  // Start checking on the form so You get can open with a settled list.
  const reachable = useSwapDestinations(!isLegacyPair || isGetPicker ? fromAsset : undefined);

  if (name === SWAP_MODAL.OPEN_PAY_PICKER.name) return <SwapAssetPicker key="pay" side="pay" />;
  if (isGetPicker)
    return <SwapAssetPicker key="get" side="get" fromAsset={fromAsset} reachable={reachable} />;
  if (name === SWAP_MODAL.OPEN_REVIEW.name) {
    // Confirm swap slides up over the form, which stays behind it.
    return (
      <>
        <SwapFormScreen />
        <SwapReviewScreen />
      </>
    );
  }

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
const SwapFlow = ({ name }: { name: string }) => {
  if (name === SWAP_MODAL.OPEN_SWAPPED.name) return <SwapSwappedScreen />;
  if (name === SWAP_MODAL.OPEN_ON_ITS_WAY.name) return <SwapOnItsWayScreen />;
  return (
    <SwapFlowProvider>
      <SwapFlowStep name={name} />
    </SwapFlowProvider>
  );
};

export default SwapFlow;
