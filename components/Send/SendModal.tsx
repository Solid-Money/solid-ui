import React from 'react';

import SlotTrigger from '@/components/SlotTrigger';
import { SEND_MODAL } from '@/constants/modals';
import { SendOptionProps } from '@/hooks/useSendOption';
import { SendModal as SendModalType, TokenBalance } from '@/lib/types';
import { useSendStore } from '@/store/useSendStore';

import SendTrigger from './SendTrigger';

interface SendModalProps extends Omit<SendOptionProps, 'trigger'> {
  token?: TokenBalance;
  trigger?: React.ReactNode;
  modal?: SendModalType;
}

/**
 * SendModal - now a thin wrapper around trigger components.
 *
 * The actual modal is rendered by SendModalProvider at the app root.
 * This component only renders the trigger button to open the modal.
 *
 * For headless usage (no trigger or token), this component renders nothing
 * since the global SendModalProvider handles the modal state.
 */
const SendModal = ({ token, trigger, modal }: SendModalProps) => {
  const { setModal } = useSendStore();

  // If token is provided, use the specialized SendTrigger
  if (token) {
    return <SendTrigger token={token} />;
  }

  // Headless usage - the global SendModalProvider handles the modal
  if (!trigger) {
    return null;
  }

  const handlePress = () => {
    setModal(modal || SEND_MODAL.OPEN_SEND_SEARCH);
  };

  return <SlotTrigger onPress={handlePress}>{trigger}</SlotTrigger>;
};

export default SendModal;
