import React from 'react';
import { Pressable, View } from 'react-native';

import { STAKE_MODAL } from '@/constants/modals';
import { TRACKING_EVENTS } from '@/constants/tracking-events';
import { track } from '@/lib/analytics';
import { useStakeStore } from '@/store/useStakeStore';
import { StakeTrigger } from '.';

type StakeModalProps = {
  trigger?: React.ReactNode;
};

/**
 * StakeModal - now a thin wrapper around trigger components.
 *
 * The actual modal is rendered by StakeModalProvider at the app root.
 * This component only renders the trigger button to open the modal.
 *
 * For headless usage (trigger={null}), this component renders nothing
 * since the global StakeModalProvider handles the modal state.
 */
const StakeModal = ({ trigger }: StakeModalProps) => {
  const { setModal } = useStakeStore();

  const handlePress = () => {
    track(TRACKING_EVENTS.STAKE_MODAL_OPENED, {
      source: 'stake_modal',
    });
    setModal(STAKE_MODAL.OPEN_FORM);
  };

  // Headless usage - the global StakeModalProvider handles the modal
  if (trigger === null) {
    return null;
  }

  // Use default trigger if not provided
  const triggerElement = trigger || <StakeTrigger />;

  // Always wrap with Pressable to ensure click handling works
  // pointerEvents="none" on the inner View ensures the Pressable captures the touch/click
  return (
    <Pressable onPress={handlePress}>
      <View pointerEvents="none">
        {triggerElement}
      </View>
    </Pressable>
  );
};

export default StakeModal;
