import React from 'react';
import { useRouter } from 'expo-router';

import ResponsiveModal from '@/components/ResponsiveModal';
import TransactionStatus from '@/components/TransactionStatus';
import { WITHDRAW_MODAL } from '@/constants/modals';
import getTokenIcon from '@/lib/getTokenIcon';
import { useWithdrawStore } from '@/store/useWithdrawStore';
import { Withdraw, WithdrawTrigger } from '.';
import { path } from '@/constants/path';
import { track } from '@/lib/firebase';

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
    track('withdraw_transaction_status_pressed', {
      amount: transaction.amount,
      source: 'withdraw_modal',
    });
    setModal(WITHDRAW_MODAL.CLOSE);
    router.push(path.ACTIVITY);
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
      track('withdraw_modal_opened', {
        source: 'withdraw_modal',
      });
      setModal(WITHDRAW_MODAL.OPEN_FORM);
    } else {
      track('withdraw_modal_closed', {
        source: 'withdraw_modal',
      });
      setModal(WITHDRAW_MODAL.CLOSE);
    }
  };

  return (
    <ResponsiveModal
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
    </ResponsiveModal>
  );
};

export default WithdrawModal;
