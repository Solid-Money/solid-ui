import { useRouter } from 'expo-router';
import React from 'react';

import ResponsiveModal from '@/components/ResponsiveModal';
import TransactionStatus from '@/components/TransactionStatus';
import { STAKE_MODAL } from '@/constants/modals';
import { path } from '@/constants/path';
import { TRACKING_EVENTS } from '@/constants/tracking-events';
import { track } from '@/lib/analytics';
import getTokenIcon from '@/lib/getTokenIcon';
import { useStakeStore } from '@/store/useStakeStore';
import { Stake } from '.';

/**
 * Global stake modal provider that renders a single ResponsiveModal instance.
 * This prevents multiple overlays from stacking when multiple StakeModal
 * components are mounted across different screens.
 *
 * Add this component once at the app root level.
 * Use setModal() from useStakeStore to open the modal.
 */
const StakeModalProvider = () => {
  const router = useRouter();
  const { currentModal, previousModal, setModal, transaction } = useStakeStore();

  const isTransactionStatus = currentModal.name === STAKE_MODAL.OPEN_TRANSACTION_STATUS.name;
  const isClose = currentModal.name === STAKE_MODAL.CLOSE.name;
  const shouldAnimate = previousModal.name !== STAKE_MODAL.CLOSE.name;
  const isForward = currentModal.number > previousModal.number;

  const getTitle = () => {
    if (isTransactionStatus) return undefined;
    return 'Deposit';
  };

  const handleTransactionStatusPress = () => {
    track(TRACKING_EVENTS.STAKE_TRANSACTION_STATUS_PRESSED, {
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
      track(TRACKING_EVENTS.STAKE_MODAL_OPENED, {
        source: 'stake_modal',
      });
      setModal(STAKE_MODAL.OPEN_FORM);
    } else {
      track(TRACKING_EVENTS.STAKE_MODAL_CLOSED, {
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
      trigger={null}
      title={getTitle()}
      contentKey={getContentKey()}
      shouldAnimate={shouldAnimate}
      isForward={isForward}
    >
      {getContent()}
    </ResponsiveModal>
  );
};

export default StakeModalProvider;
