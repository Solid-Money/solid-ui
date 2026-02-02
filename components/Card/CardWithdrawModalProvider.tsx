import React, { useCallback } from 'react';
import { useRouter } from 'expo-router';
import { useShallow } from 'zustand/react/shallow';

import ResponsiveModal from '@/components/ResponsiveModal';
import TransactionStatus from '@/components/TransactionStatus';
import { CARD_WITHDRAW_MODAL } from '@/constants/modals';
import getTokenIcon from '@/lib/getTokenIcon';
import { CardDepositSource } from '@/store/useCardDepositStore';
import { useCardWithdrawStore } from '@/store/useCardWithdrawStore';

import CardWithdrawForm from './CardWithdrawForm';

/**
 * Global card withdraw modal provider. Renders a single ResponsiveModal.
 * Use setModal() from useCardWithdrawStore to open the modal.
 */
const CardWithdrawModalProvider = () => {
  const router = useRouter();
  const { currentModal, previousModal, setModal, transaction } = useCardWithdrawStore(
    useShallow(state => ({
      currentModal: state.currentModal,
      previousModal: state.previousModal,
      setModal: state.setModal,
      transaction: state.transaction,
    })),
  );

  const isClose = currentModal.name === CARD_WITHDRAW_MODAL.CLOSE.name;
  const isForm = currentModal.name === CARD_WITHDRAW_MODAL.OPEN_FORM.name;
  const isTransactionStatus =
    currentModal.name === CARD_WITHDRAW_MODAL.OPEN_TRANSACTION_STATUS.name;
  const shouldAnimate = previousModal.name !== CARD_WITHDRAW_MODAL.CLOSE.name;
  const isForward = currentModal.number > previousModal.number;

  const handleTransactionStatusPress = useCallback(() => {
    setModal(CARD_WITHDRAW_MODAL.CLOSE);
    router.push('/activity?tab=card');
  }, [setModal, router]);

  const handleOpenChange = useCallback(
    (value: boolean) => {
      if (!value) {
        setModal(CARD_WITHDRAW_MODAL.CLOSE);
      }
    },
    [setModal],
  );

  const getContentKey = () => {
    if (isTransactionStatus) return 'transaction-status';
    if (isForm) return 'withdraw-form';
    return 'close';
  };

  const getContent = () => {
    if (isTransactionStatus) {
      const token = transaction.to === CardDepositSource.SAVINGS ? 'soUSD' : 'USDC';
      return (
        <TransactionStatus
          amount={transaction.amount ?? 0}
          onPress={handleTransactionStatusPress}
          token={token}
          icon={getTokenIcon({ tokenSymbol: token })}
          title="Withdrawal started"
          description="This may take up to 5 minutes. We'll keep processing this in the background. You can safely leave this page."
          status="Initiated"
          buttonText="View activity"
        />
      );
    }
    if (isForm) return <CardWithdrawForm />;
    return null;
  };

  return (
    <ResponsiveModal
      currentModal={currentModal}
      previousModal={previousModal}
      isOpen={!isClose}
      onOpenChange={handleOpenChange}
      trigger={null}
      title="Withdraw from card"
      containerClassName="min-h-[42rem] overflow-y-auto flex-1"
      contentKey={getContentKey()}
      showBackButton={false}
      shouldAnimate={shouldAnimate}
      isForward={isForward}
    >
      {getContent()}
    </ResponsiveModal>
  );
};

export default CardWithdrawModalProvider;
