import React, { useCallback } from 'react';
import { useShallow } from 'zustand/react/shallow';

import ResponsiveModal from '@/components/ResponsiveModal';
import { CARD_PIN_MODAL } from '@/constants/modals';
import { useCardPinStore } from '@/store/useCardPinStore';

import ManagePinForm from './ManagePinForm';

/**
 * Global card PIN modal provider that renders a single ResponsiveModal instance.
 * Add this component once at the app root level (via DeferredModalProviders).
 * Use setModal() from useCardPinStore to open the modal.
 */
const ManagePinModalProvider = () => {
  const { currentModal, previousModal, setModal } = useCardPinStore(
    useShallow(state => ({
      currentModal: state.currentModal ?? CARD_PIN_MODAL.CLOSE,
      previousModal: state.previousModal ?? CARD_PIN_MODAL.CLOSE,
      setModal: state.setModal,
    })),
  );

  const isClose = currentModal.name === CARD_PIN_MODAL.CLOSE.name;
  const shouldAnimate = previousModal.name !== CARD_PIN_MODAL.CLOSE.name;
  const isForward = currentModal.number > previousModal.number;

  const handleOpenChange = useCallback(
    (value: boolean) => {
      if (value) {
        setModal(CARD_PIN_MODAL.OPEN_FORM);
      } else {
        setModal(CARD_PIN_MODAL.CLOSE);
      }
    },
    [setModal],
  );

  return (
    <ResponsiveModal
      currentModal={currentModal}
      previousModal={previousModal}
      isOpen={!isClose}
      onOpenChange={handleOpenChange}
      trigger={null}
      title="Manage PIN"
      contentKey="pin-form"
      shouldAnimate={shouldAnimate}
      isForward={isForward}
    >
      <ManagePinForm />
    </ResponsiveModal>
  );
};

export default ManagePinModalProvider;
