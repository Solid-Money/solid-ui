import React, { ReactNode } from 'react';
import { Pressable, View } from 'react-native';

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
  const {
    actions: { setModal },
  } = useSwapState();

  const handlePress = () => {
    setModal(SWAP_MODAL.OPEN_FORM);
  };

  const content = trigger || children;

  if (!content) {
    return null;
  }

  // Always wrap with Pressable to ensure click handling works
  // pointerEvents="none" on the inner View ensures the Pressable captures the touch/click
  return (
    <Pressable onPress={handlePress}>
      <View pointerEvents="none" className="flex-1">
        {content}
      </View>
    </Pressable>
  );
};

export default SwapTrigger;
