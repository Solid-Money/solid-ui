import React, { useCallback } from 'react';
import { useShallow } from 'zustand/react/shallow';

import ResponsiveModal from '@/components/ResponsiveModal';
import { CARD_WITHDRAW_MODAL } from '@/constants/modals';
import { useCardWithdrawStore } from '@/store/useCardWithdrawStore';

import CardWithdrawForm from './CardWithdrawForm';

/**
 * Global card withdraw modal provider. Renders a single ResponsiveModal.
 * Use setModal() from useCardWithdrawStore to open the modal.
 */
const CardWithdrawModalProvider = () => {
  const { currentModal, previousModal, setModal } = useCardWithdrawStore(
    useShallow(state => ({
      currentModal: state.currentModal,
      previousModal: state.previousModal,
      setModal: state.setModal,
    })),
  );

  const isClose = currentModal.name === CARD_WITHDRAW_MODAL.CLOSE.name;
  const isForm = currentModal.name === CARD_WITHDRAW_MODAL.OPEN_FORM.name;
  const shouldAnimate = previousModal.name !== CARD_WITHDRAW_MODAL.CLOSE.name;
  const isForward = currentModal.number > previousModal.number;

  const handleOpenChange = useCallback(
    (value: boolean) => {
      if (!value) {
        setModal(CARD_WITHDRAW_MODAL.CLOSE);
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
      title="Withdraw from card"
      containerClassName="min-h-[42rem] overflow-y-auto flex-1"
      contentKey={isForm ? 'withdraw-form' : 'close'}
      showBackButton={false}
      shouldAnimate={shouldAnimate}
      isForward={isForward}
    >
      {isForm ? <CardWithdrawForm /> : null}
    </ResponsiveModal>
  );
};

export default CardWithdrawModalProvider;
