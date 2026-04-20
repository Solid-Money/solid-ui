import React, { useCallback, useEffect, useRef } from 'react';
import { useRouter } from 'expo-router';
import { useShallow } from 'zustand/react/shallow';

import ResponsiveModal from '@/components/ResponsiveModal';
import TransactionStatus from '@/components/TransactionStatus';
import { CARD_DEPOSIT_MODAL } from '@/constants/modals';
import { path } from '@/constants/path';
import { TRACKING_EVENTS } from '@/constants/tracking-events';
import { track } from '@/lib/analytics';
import getTokenIcon from '@/lib/getTokenIcon';
import { useCardDepositStore } from '@/store/useCardDepositStore';

import CardDepositExternal from './CardDepositExternal';
import CardDepositInternalForm from './CardDepositInternalForm';
import CardDepositOptions from './CardDepositOptions';
import CardDepositTokenSelector from './CardDepositTokenSelector';

/**
 * Global card deposit modal provider that renders a single ResponsiveModal instance.
 * This prevents multiple overlays from stacking when multiple DepositToCardModal
 * components are mounted across different screens.
 *
 * Add this component once at the app root level.
 * Use setModal() from useCardDepositStore to open the modal.
 */
const CardDepositModalProvider = () => {
  const router = useRouter();
  const { currentModal, previousModal, setModal, transaction, setSource } = useCardDepositStore(
    useShallow(state => ({
      currentModal: state.currentModal ?? CARD_DEPOSIT_MODAL.CLOSE,
      previousModal: state.previousModal ?? CARD_DEPOSIT_MODAL.CLOSE,
      setModal: state.setModal,
      transaction: state.transaction,
      setSource: state.setSource,
    })),
  );

  const isClose = currentModal.name === CARD_DEPOSIT_MODAL.CLOSE.name;
  const isOptions = currentModal.name === CARD_DEPOSIT_MODAL.OPEN_OPTIONS.name;
  const isInternal = currentModal.name === CARD_DEPOSIT_MODAL.OPEN_INTERNAL_FORM.name;
  const isExternal = currentModal.name === CARD_DEPOSIT_MODAL.OPEN_EXTERNAL_FORM.name;
  const isTokenSelector = currentModal.name === CARD_DEPOSIT_MODAL.OPEN_TOKEN_SELECTOR.name;
  const isTransactionStatus = currentModal.name === CARD_DEPOSIT_MODAL.OPEN_TRANSACTION_STATUS.name;
  const shouldAnimate = previousModal.name !== CARD_DEPOSIT_MODAL.CLOSE.name;
  const isForward = currentModal.number > previousModal.number;

  // Track modal open/close state
  const hasTrackedOpenRef = useRef(false);
  const hasTrackedTransactionStatusRef = useRef(false);

  // Helper to get current step name for tracking
  const getCurrentStep = useCallback(() => {
    if (isOptions) return 'options';
    if (isInternal) return 'internal_form';
    if (isExternal) return 'external_form';
    if (isTransactionStatus) return 'transaction_status';
    return 'closed';
  }, [isOptions, isInternal, isExternal, isTransactionStatus]);

  // Track modal opened
  useEffect(() => {
    if (!isClose && !hasTrackedOpenRef.current) {
      hasTrackedOpenRef.current = true;
      track(TRACKING_EVENTS.CARD_DEPOSIT_MODAL_OPENED, {});
    }
    // Reset tracking state and clear source when modal fully closes
    if (isClose) {
      hasTrackedOpenRef.current = false;
      hasTrackedTransactionStatusRef.current = false;
      setSource(undefined); // Clear source so it defaults to BORROW next time
    }
  }, [isClose, setSource]);

  // Track transaction status viewed (only once per session)
  useEffect(() => {
    if (isTransactionStatus && !hasTrackedTransactionStatusRef.current) {
      hasTrackedTransactionStatusRef.current = true;
      track(TRACKING_EVENTS.CARD_DEPOSIT_TRANSACTION_STATUS_VIEWED, {
        amount: transaction.amount,
      });
    }
  }, [isTransactionStatus, transaction.amount]);

  const handleTransactionStatusPress = useCallback(() => {
    track(TRACKING_EVENTS.CARD_DEPOSIT_TRANSACTION_STATUS_PRESSED, {
      amount: transaction.amount,
    });
    setModal(CARD_DEPOSIT_MODAL.CLOSE);
    router.push(path.ACTIVITY);
  }, [transaction.amount, setModal, router]);

  const getTitle = useCallback(() => {
    if (isTransactionStatus) return undefined;
    if (isTokenSelector) return 'Select token';
    return 'Deposit to Card';
  }, [isTransactionStatus, isTokenSelector]);

  const getContentKey = useCallback(() => {
    if (isTransactionStatus) return 'transaction-status';
    if (isOptions) return 'options';
    if (isInternal) return 'internal';
    if (isExternal) return 'external';
    if (isTokenSelector) return 'token-selector';
    return 'options';
  }, [isTransactionStatus, isOptions, isInternal, isExternal, isTokenSelector]);

  const getContent = useCallback(() => {
    if (isTransactionStatus) {
      return (
        <TransactionStatus
          amount={transaction.amount ?? 0}
          onPress={handleTransactionStatusPress}
          token="USDC"
          icon={getTokenIcon({ tokenSymbol: 'USDC' })}
          title="Card deposit initiated"
          description="Your deposit is being processed. This may take a few minutes."
          status="Processing"
        />
      );
    }
    if (isOptions) return <CardDepositOptions />;
    if (isInternal) return <CardDepositInternalForm />;
    if (isExternal) return <CardDepositExternal />;
    if (isTokenSelector) return <CardDepositTokenSelector />;
    return <CardDepositOptions />;
  }, [
    isTransactionStatus,
    isOptions,
    isInternal,
    isExternal,
    isTokenSelector,
    transaction.amount,
    handleTransactionStatusPress,
  ]);

  const handleOpenChange = useCallback(
    (value: boolean) => {
      if (value) {
        setModal(CARD_DEPOSIT_MODAL.OPEN_INTERNAL_FORM);
      } else {
        track(TRACKING_EVENTS.CARD_DEPOSIT_MODAL_CLOSED, {
          close_reason: 'user_dismissed',
          current_step: getCurrentStep(),
        });
        setModal(CARD_DEPOSIT_MODAL.CLOSE);
      }
    },
    [getCurrentStep, setModal],
  );

  const handleBackPress = useCallback(() => {
    if (isTokenSelector) {
      setModal(CARD_DEPOSIT_MODAL.OPEN_INTERNAL_FORM);
      return;
    }
    setModal(CARD_DEPOSIT_MODAL.CLOSE);
  }, [isTokenSelector, setModal]);

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
      showBackButton={(isInternal || isTokenSelector) && !isTransactionStatus}
      onBackPress={handleBackPress}
      shouldAnimate={shouldAnimate}
      isForward={isForward}
    >
      {getContent()}
    </ResponsiveModal>
  );
};

export default CardDepositModalProvider;
