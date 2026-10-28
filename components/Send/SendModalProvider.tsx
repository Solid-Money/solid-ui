import React from 'react';
import { useShallow } from 'zustand/react/shallow';

import ResponsiveModal from '@/components/ResponsiveModal';
import DiscardChangesDialog from '@/components/Send/DiscardChangesDialog';
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
    customHeaderLayout,
    fillViewportHeight,
    hideHeader,
    shouldOpen,
    showBackButton,
    compactHeader,
    shouldAnimate,
    isForward,
    getContent,
    getContentKey,
    getTitle,
    getContentClassName,
    getContainerClassName,
    getDisableScroll,
    handleOpenChange,
    handleBackPress,
    showDiscardDialog,
    handleDiscardConfirm,
    handleDiscardCancel,
  } = useSendOption();
  // Use useShallow for object selection to prevent unnecessary re-renders
  const { currentModal, previousModal } = useSendStore(
    useShallow(state => ({
      currentModal: state.currentModal,
      previousModal: state.previousModal,
    })),
  );

  return (
    <>
      <ResponsiveModal
        currentModal={currentModal}
        previousModal={previousModal}
        isOpen={shouldOpen}
        onOpenChange={handleOpenChange}
        trigger={null}
        title={getTitle()}
        contentClassName={getContentClassName()}
        containerClassName={getContainerClassName()}
        titleClassName={customHeaderLayout ? 'h-14 pb-4 web:[font-synthesis:none]' : undefined}
        mobileTopOffset={customHeaderLayout ? 72 : undefined}
        compactControls={customHeaderLayout}
        showBackButton={showBackButton}
        compactHeader={compactHeader}
        onBackPress={handleBackPress}
        shouldAnimate={shouldAnimate}
        isForward={isForward}
        contentKey={getContentKey()}
        disableScroll={getDisableScroll()}
        hideHeader={hideHeader}
        fillViewportHeight={fillViewportHeight}
      >
        {getContent()}
      </ResponsiveModal>
      <DiscardChangesDialog
        visible={showDiscardDialog}
        onDiscard={handleDiscardConfirm}
        onCancel={handleDiscardCancel}
      />
    </>
  );
};

export default SendModalProvider;
