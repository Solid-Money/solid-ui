import { useRouter } from 'expo-router';
import React from 'react';

import ResponsiveModal from '@/components/ResponsiveModal';
import TransactionStatus from '@/components/TransactionStatus';
import { SWAP_MODAL } from '@/constants/modals';
import { path } from '@/constants/path';
import getTokenIcon from '@/lib/getTokenIcon';
import { useSwapState } from '@/store/swapStore';

const SwapModal = () => {
  const router = useRouter();

  const {
    currentModal,
    previousModal,
    transaction,
    actions: { setModal },
  } = useSwapState();

  const isTransactionStatus = currentModal.name === SWAP_MODAL.OPEN_TRANSACTION_STATUS.name;
  const isClose = currentModal.name === SWAP_MODAL.CLOSE.name;

  const handleTransactionStatusPress = () => {
    setModal(SWAP_MODAL.CLOSE);
    router.push(path.ACTIVITY);
  };

  const getTitle = () => {
    if (isTransactionStatus) return undefined;
    return 'Swap';
  };

  const getContentKey = () => {
    if (isTransactionStatus) return 'transaction-status';
    return 'swap-form';
  };

  const getContent = () => {
    if (isTransactionStatus) {
      return (
        <TransactionStatus
          amount={transaction.amount ?? 0}
          address={transaction.address}
          onPress={handleTransactionStatusPress}
          title="Transaction completed"
          description="Your transaction has been successfully processed and confirmed."
          status="Completed"
          token={transaction.inputCurrencySymbol ?? 'Token'}
          icon={getTokenIcon({
            tokenSymbol: transaction.inputCurrencySymbol,
            size: 24,
          })}
        />
      );
    }

    return null;
  };

  return (
    <ResponsiveModal
      currentModal={currentModal}
      previousModal={previousModal}
      isOpen={!isClose}
      onOpenChange={(value: boolean) => {
        if (!value) {
          setModal(SWAP_MODAL.CLOSE);
        }
      }}
      trigger={null}
      title={getTitle()}
      titleClassName="justify-center"
      contentKey={getContentKey()}
    >
      {getContent()}
    </ResponsiveModal>
  );
};

export default SwapModal;
