import React from 'react';
import { useRouter } from 'expo-router';

import ResponsiveModal from '@/components/ResponsiveModal';
import TransactionStatus from '@/components/TransactionStatus';
import { CARD_REPAY_MODAL } from '@/constants/modals';
import { path } from '@/constants/path';
import getTokenIcon from '@/lib/getTokenIcon';
import { useCardRepayStore } from '@/store/useCardRepayStore';

import CardRepayForm from './CardRepayForm';
import CardRepayTokenSelector from './CardRepayTokenSelector';

/**
 * Global card repay modal provider that renders a single ResponsiveModal instance.
 * This prevents multiple overlays from stacking when multiple RepayToCardModal
 * components are mounted across different screens.
 *
 * Add this component once at the app root level.
 * Use setModal() from useCardRepayStore to open the modal.
 */
const CardRepayModalProvider = () => {
  const router = useRouter();
  const { currentModal, previousModal, setModal, transaction } = useCardRepayStore();

  const isClose = currentModal.name === CARD_REPAY_MODAL.CLOSE.name;
  const isForm = currentModal.name === CARD_REPAY_MODAL.OPEN_FORM.name;
  const isTokenSelector = currentModal.name === CARD_REPAY_MODAL.OPEN_TOKEN_SELECTOR.name;
  const isTransactionStatus = currentModal.name === CARD_REPAY_MODAL.OPEN_TRANSACTION_STATUS.name;
  const shouldAnimate = previousModal.name !== CARD_REPAY_MODAL.CLOSE.name;
  const isForward = currentModal.number > previousModal.number;

  const handleTransactionStatusPress = () => {
    setModal(CARD_REPAY_MODAL.CLOSE);
    router.push(path.ACTIVITY);
  };

  const getTitle = () => {
    if (isTransactionStatus) return undefined;
    if (isTokenSelector) return 'Select token';
    return 'Repay';
  };

  const getContentKey = () => {
    if (isTransactionStatus) return 'transaction-status';
    if (isTokenSelector) return 'token-selector';
    if (isForm) return 'form';
    return 'form';
  };

  const getContent = () => {
    if (isTransactionStatus) {
      return (
        <TransactionStatus
          amount={transaction.amount ?? 0}
          onPress={handleTransactionStatusPress}
          token="USDC"
          icon={getTokenIcon({ tokenSymbol: 'USDC' })}
          title="Card repay initiated"
          description="Your repay is being processed. This may take a few minutes."
          status="Processing"
        />
      );
    }
    if (isTokenSelector) return <CardRepayTokenSelector />;
    if (isForm) return <CardRepayForm />;
    return <CardRepayForm />;
  };

  const handleBackPress = () => {
    if (isTokenSelector) {
      setModal(CARD_REPAY_MODAL.OPEN_FORM);
    }
  };

  const handleOpenChange = (value: boolean) => {
    if (value) setModal(CARD_REPAY_MODAL.OPEN_FORM);
    else setModal(CARD_REPAY_MODAL.CLOSE);
  };

  return (
    <ResponsiveModal
      currentModal={currentModal}
      previousModal={previousModal}
      isOpen={!isClose}
      onOpenChange={handleOpenChange}
      trigger={null}
      title={getTitle()}
      containerClassName="min-h-[42rem] overflow-y-auto flex-1"
      contentKey={getContentKey()}
      showBackButton={isTokenSelector}
      onBackPress={handleBackPress}
      shouldAnimate={shouldAnimate}
      isForward={isForward}
    >
      {getContent()}
    </ResponsiveModal>
  );
};

export default CardRepayModalProvider;
