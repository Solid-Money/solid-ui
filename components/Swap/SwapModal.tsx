import React, { ReactNode, useEffect } from 'react';

import { SWAP_MODAL } from '@/constants/modals';
import { useSwapState } from '@/store/swapStore';
import SwapTrigger from './SwapTrigger';

type SwapModalProps = {
  trigger?: ReactNode;
  defaultOpen?: boolean;
  onClose?: () => void;
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
const SwapModal = ({ trigger = null, defaultOpen = false }: SwapModalProps) => {
  const {
    actions: { setModal },
  } = useSwapState();

  // Handle defaultOpen prop for backward compatibility
  useEffect(() => {
    if (defaultOpen) {
      const rafId = requestAnimationFrame(() => {
        setModal(SWAP_MODAL.OPEN_FORM);
      });
      return () => cancelAnimationFrame(rafId);
    }
  }, [defaultOpen, setModal]);

  // Headless usage - the global SwapModalProvider handles the modal
  if (trigger === null) {
    return null;
  }

  return <SwapTrigger trigger={trigger} />;
};

export default SwapModal;
