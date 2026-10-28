import React, { ReactNode } from 'react';

import SlotTrigger from '@/components/SlotTrigger';
import { SwapPreset } from '@/lib/swapDefaults';
import { SwapEntryPoint, useSwapState } from '@/store/swapStore';

type SwapTriggerProps = {
  trigger?: ReactNode;
  children?: ReactNode;
  /** Where this button sits, for `swap_modal_viewed`. */
  entryPoint?: SwapEntryPoint;
  /** The pair the form opens on; the last pair used when left out. */
  preset?: SwapPreset;
};

/**
 * Trigger component for opening the swap modal.
 * Does not render any modal/overlay - just the trigger button.
 *
 * The actual modal is rendered by SwapModalProvider at the app root.
 */
const SwapTrigger = ({ trigger, children, entryPoint = 'unknown', preset }: SwapTriggerProps) => {
  const openSwap = useSwapState(state => state.actions.openSwap);

  const handlePress = () => {
    openSwap({ entryPoint, ...preset });
  };

  const content = trigger || children;

  if (!content) {
    return null;
  }

  return <SlotTrigger onPress={handlePress}>{content}</SlotTrigger>;
};

export default SwapTrigger;
