import React from 'react';

import ResponsiveModal from '@/components/ResponsiveModal';
import useSendOption from '@/hooks/useSendOption';
import { useSendStore } from '@/store/useSendStore';

/**
 * Global send modal provider that renders a single ResponsiveModal instance.
 * This prevents multiple overlays from stacking when multiple SendModal
 * components are mounted across different screens.
 *
 * Add this component once at the app root level.
 * Use SendTrigger or setModal() from useSendStore to open the modal.
 */
const SendModalProvider = () => {
  const {
    shouldOpen,
    showBackButton,
    shouldAnimate,
    isForward,
    getContent,
    getContentKey,
    getTitle,
    getContentClassName,
    getContainerClassName,
    handleOpenChange,
    handleBackPress,
  } = useSendOption();
  const { currentModal, previousModal } = useSendStore();

  return (
    <ResponsiveModal
      currentModal={currentModal}
      previousModal={previousModal}
      isOpen={shouldOpen}
      onOpenChange={handleOpenChange}
      trigger={null}
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

export default SendModalProvider;
