import { useRouter } from 'expo-router';
import React from 'react';

import ResponsiveModal from '@/components/ResponsiveModal';
import TransactionStatus from '@/components/TransactionStatus';
import { DEPOSIT_FROM_SAFE_ACCOUNT_MODAL } from '@/constants/modals';
import { path } from '@/constants/path';
import getTokenIcon from '@/lib/getTokenIcon';
import { useDepositFromSafeAccountStore } from '@/store/useDepositFromSafeAccount';
import { Deposit, DepositTrigger } from '.';

const DepositModal = () => {
  const router = useRouter();
  const { currentModal, previousModal, setModal, transaction } = useDepositFromSafeAccountStore();

  const isTransactionStatus =
    currentModal.name === DEPOSIT_FROM_SAFE_ACCOUNT_MODAL.OPEN_TRANSACTION_STATUS.name;
  const isClose = currentModal.name === DEPOSIT_FROM_SAFE_ACCOUNT_MODAL.CLOSE.name;

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
      trigger={<DepositTrigger />}
      title={getTitle()}
      titleClassName="justify-center"
      contentKey={getContentKey()}
    >
      {getContent()}
    </ResponsiveModal>
  );
};

export default DepositModal;
