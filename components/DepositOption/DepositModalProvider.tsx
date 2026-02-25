import { useEffect, useRef } from 'react';
import { useShallow } from 'zustand/react/shallow';

import ResponsiveModal from '@/components/ResponsiveModal';
import { DEPOSIT_MODAL } from '@/constants/modals';
import { VAULTS } from '@/constants/vaults';
import useDepositOption from '@/hooks/useDepositOption';
import { useDepositStore } from '@/store/useDepositStore';
import { useSavingStore } from '@/store/useSavingStore';

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
    // getContentClassName,
    getContainerClassName,
    handleOpenChange,
    handleBackPress,
  } = useDepositOption();
  // Use useShallow for object selection to prevent unnecessary re-renders
  const { currentModal, previousModal, resetDepositFlow } = useDepositStore(
    useShallow(state => ({
      currentModal: state.currentModal,
      previousModal: state.previousModal,
      resetDepositFlow: state.resetDepositFlow,
    })),
  );
  const selectedVault = useSavingStore(state => state.selectedVault);
  const previousVaultNameRef = useRef<string | null>(null);

  useEffect(() => {
    const nextVaultName = VAULTS[selectedVault]?.name;
    if (!nextVaultName) return;
    if (previousVaultNameRef.current && previousVaultNameRef.current !== nextVaultName) {
      // Don't reset when user is selecting vault from the vault selector step.
      // Check both OPEN_VAULT_SELECTOR and OPEN_OPTIONS because React 18 batching
      // may have already transitioned the modal to OPEN_OPTIONS by the time this effect runs.
      const isSelectingFromModal =
        currentModal.name === DEPOSIT_MODAL.OPEN_VAULT_SELECTOR.name ||
        previousModal.name === DEPOSIT_MODAL.OPEN_VAULT_SELECTOR.name;
      if (!isSelectingFromModal) {
        resetDepositFlow();
      }
    }
    previousVaultNameRef.current = nextVaultName;
  }, [resetDepositFlow, selectedVault, currentModal.name, previousModal.name]);

  return (
    <ResponsiveModal
      currentModal={currentModal}
      previousModal={previousModal}
      isOpen={shouldOpen}
      onOpenChange={handleOpenChange}
      trigger={null}
      title={getTitle()}
      // contentClassName={getContentClassName()}
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
