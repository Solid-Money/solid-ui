import React from 'react';
import { useRouter } from 'expo-router';

import AnimatedModal from '@/components/AnimatedModal';
import TransactionStatus from '@/components/TransactionStatus';
import { UNSTAKE_MODAL } from '@/constants/modals';
import getTokenIcon from '@/lib/getTokenIcon';
import { useUnstakeStore } from '@/store/useUnstakeStore';
import { Unstake, UnstakeTrigger } from '.';
import { path } from '@/constants/path';

const UnstakeModal = () => {
  const router = useRouter();
  const { currentModal, previousModal, setModal, transaction } = useUnstakeStore();

  const isTransactionStatus = currentModal.name === UNSTAKE_MODAL.OPEN_TRANSACTION_STATUS.name;
  const isClose = currentModal.name === UNSTAKE_MODAL.CLOSE.name;

  const getTitle = () => {
    if (isTransactionStatus) return undefined;
    return 'Unstake';
  };

  const handleTransactionStatusPress = () => {
    setModal(UNSTAKE_MODAL.CLOSE);
    router.push(path.SAVINGS);
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
    <AnimatedModal
      currentModal={currentModal}
      previousModal={previousModal}
      isOpen={!isClose}
      onOpenChange={handleOpenChange}
      trigger={<UnstakeTrigger />}
      title={getTitle()}
      titleClassName="justify-center"
      contentKey={getContentKey()}
    >
      {getContent()}
    </AnimatedModal>
  );
};

export default UnstakeModal;
