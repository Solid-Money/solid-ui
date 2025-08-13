import React from 'react';
import { useRouter } from 'expo-router';

import AnimatedModal from '@/components/AnimatedModal';
import TransactionStatus from '@/components/TransactionStatus';
import { WITHDRAW_MODAL } from '@/constants/modals';
import getTokenIcon from '@/lib/getTokenIcon';
import { useWithdrawStore } from '@/store/useWithdrawStore';
import { Withdraw, WithdrawTrigger } from '.';
import { path } from '@/constants/path';

const WithdrawModal = () => {
  const router = useRouter();
  const { currentModal, previousModal, setModal, transaction } = useWithdrawStore();

  const isTransactionStatus = currentModal.name === WITHDRAW_MODAL.OPEN_TRANSACTION_STATUS.name;
  const isClose = currentModal.name === WITHDRAW_MODAL.CLOSE.name;

  const getTitle = () => {
    if (isTransactionStatus) return undefined;
    return 'Withdraw';
  };

  const handleTransactionStatusPress = () => {
    setModal(WITHDRAW_MODAL.CLOSE);
    router.push(path.SAVINGS);
  };

  const getContentKey = () => {
    if (isTransactionStatus) return 'transaction-status';
    return 'withdraw-form';
  };

  const getContent = () => {
    if (isTransactionStatus) {
      return (
        <TransactionStatus
          amount={transaction.amount ?? 0}
          onPress={handleTransactionStatusPress}
          token={'SoUSD'}
          icon={getTokenIcon({ tokenSymbol: 'SoUSD' })}
        />
      );
    }

    return <Withdraw />;
  };

  const handleOpenChange = (value: boolean) => {
    if (value) {
      setModal(WITHDRAW_MODAL.OPEN_FORM);
    } else {
      setModal(WITHDRAW_MODAL.CLOSE);
    }
  };

  return (
    <AnimatedModal
      currentModal={currentModal}
      previousModal={previousModal}
      isOpen={!isClose}
      onOpenChange={handleOpenChange}
      trigger={<WithdrawTrigger />}
      title={getTitle()}
      titleClassName="justify-center"
      contentKey={getContentKey()}
    >
      {getContent()}
    </AnimatedModal>
  );
};

export default WithdrawModal;
