import React, { ReactNode } from 'react';

import SlotTrigger from '@/components/SlotTrigger';
import { SWAP_MODAL } from '@/constants/modals';
import { useSwapState } from '@/store/swapStore';

type SwapTriggerProps = {
  trigger?: ReactNode;
  children?: ReactNode;
};

/**
 * Trigger component for opening the swap modal.
 * Does not render any modal/overlay - just the trigger button.
 *
 * The actual modal is rendered by SwapModalProvider at the app root.
 */
const SwapTrigger = ({ trigger, children }: SwapTriggerProps) => {
  const setModal = useSwapState(state => state.actions.setModal);

  const handlePress = () => {
    setModal(SWAP_MODAL.OPEN_FORM);
  };

  const content = trigger || children;

  if (!content) {
    return null;
  }

  return <SlotTrigger onPress={handlePress}>{content}</SlotTrigger>;
};

export default SwapTrigger;
