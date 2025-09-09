import { useRouter } from 'expo-router';
import React from 'react';

import ResponsiveModal from '@/components/ResponsiveModal';
import TransactionStatus from '@/components/TransactionStatus';
import { STAKE_MODAL } from '@/constants/modals';
import { path } from '@/constants/path';
import getTokenIcon from '@/lib/getTokenIcon';
import { useStakeStore } from '@/store/useStakeStore';
import { Stake, StakeTrigger } from '.';
import { track } from '@/lib/firebase';

const StakeModal = () => {
  const router = useRouter();
  const { currentModal, previousModal, setModal, transaction } = useStakeStore();

  const isTransactionStatus = currentModal.name === STAKE_MODAL.OPEN_TRANSACTION_STATUS.name;
  const isClose = currentModal.name === STAKE_MODAL.CLOSE.name;

  const getTitle = () => {
    if (isTransactionStatus) return undefined;
    return 'Stake';
  };

  const handleTransactionStatusPress = () => {
    track('stake_transaction_status_pressed', {
      amount: transaction.amount,
      source: 'stake_modal',
    });
    setModal(STAKE_MODAL.CLOSE);
    router.push(path.ACTIVITY);
  };

  const getContentKey = () => {
    if (isTransactionStatus) return 'transaction-status';
    return 'stake-form';
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

    return <Stake />;
  };

  const handleOpenChange = (value: boolean) => {
    if (value) {
      track('stake_modal_opened', {
        source: 'stake_modal',
      });
      setModal(STAKE_MODAL.OPEN_FORM);
    } else {
      track('stake_modal_closed', {
        source: 'stake_modal',
      });
      setModal(STAKE_MODAL.CLOSE);
    }
  };

  return (
    <ResponsiveModal
      currentModal={currentModal}
      previousModal={previousModal}
      isOpen={!isClose}
      onOpenChange={handleOpenChange}
      trigger={<StakeTrigger />}
      title={getTitle()}
      titleClassName="justify-center"
      contentKey={getContentKey()}
    >
      {getContent()}
    </ResponsiveModal>
  );
};

export default StakeModal;
