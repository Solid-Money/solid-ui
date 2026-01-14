import React from 'react';

import SlotTrigger from '@/components/SlotTrigger';
import { WITHDRAW_MODAL } from '@/constants/modals';
import { TRACKING_EVENTS } from '@/constants/tracking-events';
import { track } from '@/lib/analytics';
import { useWithdrawStore } from '@/store/useWithdrawStore';

import { WithdrawTrigger } from '.';

type WithdrawModalProps = {
  trigger?: React.ReactNode;
};

/**
 * WithdrawModal - now a thin wrapper around trigger components.
 *
 * The actual modal is rendered by WithdrawModalProvider at the app root.
 * This component only renders the trigger button to open the modal.
 *
 * For headless usage (trigger={null}), this component renders nothing
 * since the global WithdrawModalProvider handles the modal state.
 */
const WithdrawModal = ({ trigger }: WithdrawModalProps) => {
  const { setModal } = useWithdrawStore();

  const handlePress = () => {
    track(TRACKING_EVENTS.WITHDRAW_MODAL_OPENED, {
      source: 'withdraw_modal',
    });
    setModal(WITHDRAW_MODAL.OPEN_FORM);
  };

  if (trigger === null) {
    return null;
  }

  return <SlotTrigger onPress={handlePress}>{trigger || <WithdrawTrigger />}</SlotTrigger>;
};

export default WithdrawModal;
