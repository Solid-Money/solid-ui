import React, { isValidElement, ReactNode } from 'react';
import { Pressable, View } from 'react-native';

import { SWAP_MODAL } from '@/constants/modals';
import { useDimension } from '@/hooks/useDimension';
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
  const { isScreenMedium } = useDimension();

  const handlePress = () => {
    setModal(SWAP_MODAL.OPEN_FORM);
  };

  const content = trigger || children;

  if (!content) {
    return null;
  }

  // On web/tablet, clone the element and inject onPress directly
  // This handles cases where the trigger is already a Pressable (like CircleButton)
  if (isScreenMedium && isValidElement(content)) {
    return React.cloneElement(content as React.ReactElement<{ onPress?: () => void }>, {
      onPress: handlePress,
    });
  }

  // On mobile, wrap with pointerEvents="none" so parent Pressable captures touch
  return (
    <Pressable onPress={handlePress}>
      <View pointerEvents="none" className="flex-1">
        {content}
      </View>
    </Pressable>
  );
};

export default SwapTrigger;
