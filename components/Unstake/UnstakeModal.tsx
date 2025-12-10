import React from 'react';
import { useRouter } from 'expo-router';

import ResponsiveModal from '@/components/ResponsiveModal';
import TransactionStatus from '@/components/TransactionStatus';
import { UNSTAKE_MODAL } from '@/constants/modals';
import getTokenIcon from '@/lib/getTokenIcon';
import { useUnstakeStore } from '@/store/useUnstakeStore';
import { Unstake, UnstakeTrigger } from '.';
import { path } from '@/constants/path';

type UnstakeModalProps = {
  trigger?: React.ReactNode;
};

const UnstakeModal = ({ trigger }: UnstakeModalProps) => {
  const router = useRouter();
  const { currentModal, previousModal, setModal, transaction } = useUnstakeStore();

  const isTransactionStatus = currentModal.name === UNSTAKE_MODAL.OPEN_TRANSACTION_STATUS.name;
  const isClose = currentModal.name === UNSTAKE_MODAL.CLOSE.name;

  const getTitle = () => {
    if (isTransactionStatus) return undefined;
    return 'Withdraw from deposit';
  };

  const handleTransactionStatusPress = () => {
    setModal(UNSTAKE_MODAL.CLOSE);
    router.push(path.ACTIVITY);
  };

  const getContentKey = () => {
    if (isTransactionStatus) return 'transaction-status';
    return 'unstake-form';
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

    return <Unstake />;
  };

  const handleOpenChange = (value: boolean) => {
    if (value) {
      setModal(UNSTAKE_MODAL.OPEN_FORM);
    } else {
      setModal(UNSTAKE_MODAL.CLOSE);
    }
  };

  return (
    <ResponsiveModal
      currentModal={currentModal}
      previousModal={previousModal}
      isOpen={!isClose}
      onOpenChange={handleOpenChange}
      trigger={trigger || <UnstakeTrigger />}
      title={getTitle()}
      titleClassName="justify-center"
      contentKey={getContentKey()}
    >
      {getContent()}
    </ResponsiveModal>
  );
};

export default UnstakeModal;
