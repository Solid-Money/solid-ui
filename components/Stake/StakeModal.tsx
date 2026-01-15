import React from 'react';

import SlotTrigger from '@/components/SlotTrigger';
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
  const setModal = useStakeStore(state => state.setModal);

  const handlePress = () => {
    track(TRACKING_EVENTS.STAKE_MODAL_OPENED, {
      source: 'stake_modal',
    });
    setModal(STAKE_MODAL.OPEN_FORM);
  };

  if (trigger === null) {
    return null;
  }

  return <SlotTrigger onPress={handlePress}>{trigger || <StakeTrigger />}</SlotTrigger>;
};

export default StakeModal;
