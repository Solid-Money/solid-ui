import React from 'react';

import ResponsiveModal from '@/components/ResponsiveModal';
import useWithdrawOption from '@/hooks/useWithdrawOption';
import { useUnstakeStore } from '@/store/useUnstakeStore';

/**
 * Global unstake modal provider that renders a single ResponsiveModal instance.
 * This prevents multiple overlays from stacking when multiple UnstakeModal
 * components are mounted across different screens.
 *
 * Add this component once at the app root level.
 * Use setModal() from useUnstakeStore to open the modal.
 */
const UnstakeModalProvider = () => {
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
  } = useWithdrawOption();
  const { currentModal, previousModal } = useUnstakeStore();

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

export default UnstakeModalProvider;
