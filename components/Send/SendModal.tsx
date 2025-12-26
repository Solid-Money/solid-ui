import React from 'react';

import ResponsiveModal from '@/components/ResponsiveModal';
import { SEND_MODAL } from '@/constants/modals';
import useSendOption, { SendOptionProps } from '@/hooks/useSendOption';
import { TokenBalance } from '@/lib/types';
import { useSendStore } from '@/store/useSendStore';
import SendTrigger from './SendTrigger';

interface SendModalProps extends Omit<SendOptionProps, 'trigger'> {
  token?: TokenBalance;
  trigger?: React.ReactNode;
}

const SendModal = ({ buttonText = 'Send', token, trigger, modal }: SendModalProps) => {
  const {
    shouldOpen,
    showBackButton,
    shouldAnimate,
    isForward,
    getTrigger,
    getContent,
    getContentKey,
    getTitle,
    getContentClassName,
    getContainerClassName,
    handleOpenChange,
    handleBackPress,
  } = useSendOption({
    buttonText,
    trigger: token ? <SendTrigger token={token} /> : trigger,
    modal: modal || SEND_MODAL.OPEN_SEND_SEARCH,
  });
  const { currentModal, previousModal } = useSendStore();

  return (
    <ResponsiveModal
      currentModal={currentModal}
      previousModal={previousModal}
      isOpen={shouldOpen}
      onOpenChange={handleOpenChange}
      trigger={token || trigger ? getTrigger() : null}
      title={getTitle()}
      contentClassName={getContentClassName()}
      containerClassName={getContainerClassName()}
      showBackButton={showBackButton}
      onBackPress={handleBackPress}
      shouldAnimate={shouldAnimate}
      isForward={isForward}
      contentKey={getContentKey()}
    >
      {getContent()}
    </ResponsiveModal>
  );
};

export default SendModal;
