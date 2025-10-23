import { useRouter } from 'expo-router';
import React from 'react';

import ResponsiveModal from '@/components/ResponsiveModal';
import TransactionStatus from '@/components/TransactionStatus';
import { WITHDRAW_MODAL } from '@/constants/modals';
import { path } from '@/constants/path';
import { TRACKING_EVENTS } from '@/constants/tracking-events';
import { track } from '@/lib/analytics';
import getTokenIcon from '@/lib/getTokenIcon';
import { useWithdrawStore } from '@/store/useWithdrawStore';
import { Withdraw, WithdrawTrigger } from '.';

type WithdrawModalProps = {
  trigger?: React.ReactNode;
};

const WithdrawModal = ({ trigger }: WithdrawModalProps) => {
  const router = useRouter();
  const { currentModal, previousModal, setModal, transaction } = useWithdrawStore();

  const isTransactionStatus = currentModal.name === WITHDRAW_MODAL.OPEN_TRANSACTION_STATUS.name;
  const isClose = currentModal.name === WITHDRAW_MODAL.CLOSE.name;

  const getTitle = () => {
    if (isTransactionStatus) return undefined;
    return 'Withdraw';
  };

  const handleTransactionStatusPress = () => {
    track(TRACKING_EVENTS.WITHDRAW_TRANSACTION_STATUS_PRESSED, {
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
      track(TRACKING_EVENTS.WITHDRAW_MODAL_OPENED, {
        source: 'withdraw_modal',
      });
      setModal(WITHDRAW_MODAL.OPEN_FORM);
    } else {
      track(TRACKING_EVENTS.WITHDRAW_MODAL_CLOSED, {
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
      trigger={trigger || <WithdrawTrigger />}
      title={getTitle()}
      titleClassName="justify-center"
      contentKey={getContentKey()}
    >
      {getContent()}
    </ResponsiveModal>
  );
};

export default WithdrawModal;
