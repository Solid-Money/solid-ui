import React from 'react';
import { useRouter } from 'expo-router';
import { useShallow } from 'zustand/react/shallow';

import ResponsiveModal from '@/components/ResponsiveModal';
import TransactionStatus from '@/components/TransactionStatus';
import { DEPOSIT_FROM_SAFE_ACCOUNT_MODAL } from '@/constants/modals';
import { path } from '@/constants/path';
import getTokenIcon from '@/lib/getTokenIcon';
import { useDepositFromSafeAccountStore } from '@/store/useDepositFromSafeAccount';

import { Deposit } from '.';

/**
 * Global deposit from safe account modal provider that renders a single ResponsiveModal instance.
 * This prevents multiple overlays from stacking when multiple DepositModal
 * components are mounted across different screens.
 *
 * Add this component once at the app root level.
 * Use setModal() from useDepositFromSafeAccountStore to open the modal.
 */
const DepositFromSafeAccountModalProvider = () => {
  const router = useRouter();
  // Use useShallow for object selection to prevent unnecessary re-renders
  const { currentModal, previousModal, setModal, transaction } = useDepositFromSafeAccountStore(
    useShallow(state => ({
      currentModal: state.currentModal,
      previousModal: state.previousModal,
      setModal: state.setModal,
      transaction: state.transaction,
    })),
  );

  const isTransactionStatus =
    currentModal.name === DEPOSIT_FROM_SAFE_ACCOUNT_MODAL.OPEN_TRANSACTION_STATUS.name;
  const isClose = currentModal.name === DEPOSIT_FROM_SAFE_ACCOUNT_MODAL.CLOSE.name;
  const shouldAnimate = previousModal.name !== DEPOSIT_FROM_SAFE_ACCOUNT_MODAL.CLOSE.name;
  const isForward = currentModal.number > previousModal.number;

  const getTitle = () => {
    if (isTransactionStatus) return undefined;
    return 'Deposit';
  };

  const handleTransactionStatusPress = () => {
    setModal(DEPOSIT_FROM_SAFE_ACCOUNT_MODAL.CLOSE);
    router.push(path.ACTIVITY);
  };

  const getContentKey = () => {
    if (isTransactionStatus) return 'transaction-status';
    return 'deposit-from-safe-account-form';
  };

  const getContent = () => {
    if (isTransactionStatus) {
      return (
        <TransactionStatus
          amount={transaction.amount ?? 0}
          onPress={handleTransactionStatusPress}
          token={'USDC'}
          icon={getTokenIcon({ tokenSymbol: 'USDC' })}
        />
      );
    }

    return <Deposit />;
  };

  const handleOpenChange = (value: boolean) => {
    if (value) {
      setModal(DEPOSIT_FROM_SAFE_ACCOUNT_MODAL.OPEN_FORM);
    } else {
      setModal(DEPOSIT_FROM_SAFE_ACCOUNT_MODAL.CLOSE);
    }
  };

  return (
    <ResponsiveModal
      currentModal={currentModal}
      previousModal={previousModal}
      isOpen={!isClose}
      onOpenChange={handleOpenChange}
      trigger={null}
      title={getTitle()}
      titleClassName="justify-center"
      contentKey={getContentKey()}
      shouldAnimate={shouldAnimate}
      isForward={isForward}
    >
      {getContent()}
    </ResponsiveModal>
  );
};

export default DepositFromSafeAccountModalProvider;
