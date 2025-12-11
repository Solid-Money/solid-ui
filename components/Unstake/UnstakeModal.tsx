import ResponsiveModal from '@/components/ResponsiveModal';
import useWithdrawOption from '@/hooks/useWithdrawOption';
import { useUnstakeStore } from '@/store/useUnstakeStore';
import React from 'react';

type UnstakeModalProps = {
  trigger?: React.ReactNode;
};

const UnstakeModal = ({ trigger }: UnstakeModalProps) => {
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
  } = useWithdrawOption({ trigger });

  const { currentModal, previousModal } = useUnstakeStore();

  return (
    <ResponsiveModal
      currentModal={currentModal}
      previousModal={previousModal}
      isOpen={shouldOpen}
      onOpenChange={handleOpenChange}
      trigger={trigger ? trigger : getTrigger()}
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

export default UnstakeModal;
