import React, { ReactNode, useEffect } from 'react';

import { SwapPreset } from '@/lib/swapDefaults';
import { SwapEntryPoint, useSwapState } from '@/store/swapStore';

import SwapTrigger from './SwapTrigger';

type SwapModalProps = {
  trigger?: ReactNode;
  defaultOpen?: boolean;
  onClose?: () => void;
  /** Where this button sits, for `swap_modal_viewed`. */
  entryPoint?: SwapEntryPoint;
  /** The pair the form opens on; the last pair used when left out. */
  preset?: SwapPreset;
};

/**
 * SwapModal - now a thin wrapper around SwapTrigger.
 *
 * The actual modal is rendered by SwapModalProvider at the app root.
 * This component only renders the trigger button to open the modal.
 *
 * For headless usage (trigger={null}), this component renders nothing
 * since the global SwapModalProvider handles the modal state.
 */
const SwapModal = ({
  trigger = null,
  defaultOpen = false,
  entryPoint = 'unknown',
  preset,
}: SwapModalProps) => {
  const openSwap = useSwapState(state => state.actions.openSwap);

  // Handle defaultOpen prop for backward compatibility
  useEffect(() => {
    if (defaultOpen) {
      // On the pair already selected: a preset is for the trigger, and an
      // object rebuilt each render would reopen the form on every one.
      const rafId = requestAnimationFrame(() => {
        openSwap({ entryPoint });
      });
      return () => cancelAnimationFrame(rafId);
    }
  }, [defaultOpen, entryPoint, openSwap]);

  // Headless usage - the global SwapModalProvider handles the modal
  if (trigger === null) {
    return null;
  }

  return <SwapTrigger trigger={trigger} entryPoint={entryPoint} preset={preset} />;
};

export default SwapModal;
