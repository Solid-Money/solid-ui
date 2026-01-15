import React from 'react';
import { useRouter } from 'expo-router';
import { useShallow } from 'zustand/react/shallow';

import ResponsiveModal from '@/components/ResponsiveModal';
import TransactionStatus from '@/components/TransactionStatus';
import { CARD_DEPOSIT_MODAL } from '@/constants/modals';
import { path } from '@/constants/path';
import getTokenIcon from '@/lib/getTokenIcon';
import { useCardDepositStore } from '@/store/useCardDepositStore';

import CardDepositExternal from './CardDepositExternal';
import CardDepositInternalForm from './CardDepositInternalForm';
import CardDepositOptions from './CardDepositOptions';

/**
 * Global card deposit modal provider that renders a single ResponsiveModal instance.
 * This prevents multiple overlays from stacking when multiple DepositToCardModal
 * components are mounted across different screens.
 *
 * Add this component once at the app root level.
 * Use setModal() from useCardDepositStore to open the modal.
 */
const CardDepositModalProvider = () => {
  const router = useRouter();
  // Use useShallow for object selection to prevent unnecessary re-renders
  const { currentModal, previousModal, setModal, transaction } = useCardDepositStore(
    useShallow(state => ({
      currentModal: state.currentModal,
      previousModal: state.previousModal,
      setModal: state.setModal,
      transaction: state.transaction,
    })),
  );

  const isClose = currentModal.name === CARD_DEPOSIT_MODAL.CLOSE.name;
  const isOptions = currentModal.name === CARD_DEPOSIT_MODAL.OPEN_OPTIONS.name;
  const isInternal = currentModal.name === CARD_DEPOSIT_MODAL.OPEN_INTERNAL_FORM.name;
  const isExternal = currentModal.name === CARD_DEPOSIT_MODAL.OPEN_EXTERNAL_FORM.name;
  const isTransactionStatus = currentModal.name === CARD_DEPOSIT_MODAL.OPEN_TRANSACTION_STATUS.name;
  const shouldAnimate = previousModal.name !== CARD_DEPOSIT_MODAL.CLOSE.name;
  const isForward = currentModal.number > previousModal.number;

  const handleTransactionStatusPress = () => {
    setModal(CARD_DEPOSIT_MODAL.CLOSE);
    router.push(path.ACTIVITY);
  };

  const getTitle = () => {
    if (isTransactionStatus) return undefined;
    return 'Deposit to Card';
  };

  const getContentKey = () => {
    if (isTransactionStatus) return 'transaction-status';
    if (isOptions) return 'options';
    if (isInternal) return 'internal';
    if (isExternal) return 'external';
    return 'options';
  };

  const getContent = () => {
    if (isTransactionStatus) {
      return (
        <TransactionStatus
          amount={transaction.amount ?? 0}
          onPress={handleTransactionStatusPress}
          token="USDC"
          icon={getTokenIcon({ tokenSymbol: 'USDC' })}
          title="Card deposit initiated"
          description="Your deposit is being processed. This may take a few minutes."
          status="Processing"
        />
      );
    }
    if (isOptions) return <CardDepositOptions />;
    if (isInternal) return <CardDepositInternalForm />;
    if (isExternal) return <CardDepositExternal />;
    return <CardDepositOptions />;
  };

  const handleOpenChange = (value: boolean) => {
    if (value) setModal(CARD_DEPOSIT_MODAL.OPEN_OPTIONS);
    else setModal(CARD_DEPOSIT_MODAL.CLOSE);
  };

  const handleBackPress = () => {
    setModal(CARD_DEPOSIT_MODAL.OPEN_OPTIONS);
  };

  return (
    <ResponsiveModal
      currentModal={currentModal}
      previousModal={previousModal}
      isOpen={!isClose}
      onOpenChange={handleOpenChange}
      trigger={null}
      title={getTitle()}
      containerClassName="min-h-[42rem] overflow-y-auto flex-1"
      contentKey={getContentKey()}
      showBackButton={!isOptions && !isTransactionStatus}
      onBackPress={handleBackPress}
      shouldAnimate={shouldAnimate}
      isForward={isForward}
    >
      {getContent()}
    </ResponsiveModal>
  );
};

export default CardDepositModalProvider;
