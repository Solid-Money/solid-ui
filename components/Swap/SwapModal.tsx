import React from 'react';
import { useRouter } from 'expo-router';

import AnimatedModal from '@/components/AnimatedModal';
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

  console.log('🔥 SWAP MODAL RENDER', {
    currentModal: currentModal.name,
    isTransactionStatus,
    isClose,
    isOpen: !isClose,
    transaction,
  });

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

  console.log('🔥 SWAP MODAL ABOUT TO RENDER AnimatedModal', {
    currentModal,
    previousModal,
    isOpen: !isClose,
    title: getTitle(),
    contentKey: getContentKey(),
    content: getContent(),
  });

  return (
    <AnimatedModal
      currentModal={currentModal}
      previousModal={previousModal}
      isOpen={!isClose}
      onOpenChange={(value: boolean) => {
        console.log('🔥 SWAP MODAL onOpenChange called', { value });
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
    </AnimatedModal>
  );
};

export default SwapModal;
