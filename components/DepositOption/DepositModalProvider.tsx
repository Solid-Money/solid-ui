import { useShallow } from 'zustand/react/shallow';

import ResponsiveModal from '@/components/ResponsiveModal';
import useDepositOption from '@/hooks/useDepositOption';
import { useDepositStore } from '@/store/useDepositStore';

/**
 * Global deposit modal provider that renders a single ResponsiveModal instance.
 * This prevents multiple overlays from stacking when multiple DepositOptionModal
 * components are mounted across different screens.
 *
 * Add this component once at the app root level.
 * Use DepositTrigger or setModal() from useDepositStore to open the modal.
 */
const DepositModalProvider = () => {
  const {
    shouldOpen,
    showBackButton,
    actionButton,
    shouldAnimate,
    isForward,
    getContent,
    getContentKey,
    getTitle,
    getContentClassName,
    getContainerClassName,
    handleOpenChange,
    handleBackPress,
  } = useDepositOption();
  // Use useShallow for object selection to prevent unnecessary re-renders
  const { currentModal, previousModal } = useDepositStore(
    useShallow(state => ({
      currentModal: state.currentModal,
      previousModal: state.previousModal,
    })),
  );

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
      actionButton={actionButton}
      shouldAnimate={shouldAnimate}
      isForward={isForward}
      contentKey={getContentKey()}
    >
      {getContent()}
    </ResponsiveModal>
  );
};

export default DepositModalProvider;
