import React, { useCallback, useMemo } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { useShallow } from 'zustand/react/shallow';

import ExchangeDisclaimer from '@/components/Compliance/ExchangeDisclaimer';
import GeoRestrictionNotice from '@/components/Compliance/GeoRestrictionNotice';
import NeedHelp from '@/components/NeedHelp';
import ResponsiveModal from '@/components/ResponsiveModal';
import SwapButton from '@/components/Swap/SwapButton';
import SwapPair from '@/components/Swap/SwapPair';
import SwapParams from '@/components/Swap/SwapParams';
import TransactionStatus from '@/components/TransactionStatus';
import { SWAP_MODAL } from '@/constants/modals';
import { path } from '@/constants/path';
import { TRACKING_EVENTS } from '@/constants/tracking-events';
import useGeoCompliance from '@/hooks/useGeoCompliance';
import { track } from '@/lib/analytics';
import getTokenIcon from '@/lib/getTokenIcon';
import { useSwapState } from '@/store/swapStore';
import { useComplianceStore } from '@/store/useComplianceStore';

/**
 * Global swap modal provider that renders a single ResponsiveModal instance.
 * This prevents multiple overlays from stacking when multiple SwapModal
 * components are mounted across different screens.
 *
 * Add this component once at the app root level.
 * Use SwapTrigger or setModal() from useSwapState to open the modal.
 */
const SwapModalProvider = () => {
  const router = useRouter();
  const { isSwapAvailable } = useGeoCompliance();

  const { hasAcceptedSwapDisclaimer, acceptDisclaimer } = useComplianceStore(
    useShallow(state => ({
      hasAcceptedSwapDisclaimer: state.acceptedDisclaimers['swap'] === true,
      acceptDisclaimer: state.acceptDisclaimer,
    })),
  );

  const { currentModal, previousModal, transaction, setModal } = useSwapState(
    useShallow(state => ({
      currentModal: state.currentModal,
      previousModal: state.previousModal,
      transaction: state.transaction,
      setModal: state.actions.setModal,
    })),
  );

  const isTransactionStatus = currentModal?.name === SWAP_MODAL.OPEN_TRANSACTION_STATUS.name;
  const isClose = !currentModal || currentModal?.name === SWAP_MODAL.CLOSE.name;

  const handleOpenChange = useCallback(
    (value: boolean) => {
      if (value) {
        track(TRACKING_EVENTS.SWAP_MODAL_VIEWED, {
          previous_modal: previousModal?.name,
        });
        setModal(SWAP_MODAL.OPEN_FORM);
      } else {
        track(TRACKING_EVENTS.SWAP_MODAL_ABANDONED, {
          last_modal: currentModal?.name,
          previous_modal: previousModal?.name,
        });
        setModal(SWAP_MODAL.CLOSE);
      }
    },
    [setModal, currentModal, previousModal],
  );

  const handleTransactionStatusPress = useCallback(() => {
    setModal(SWAP_MODAL.CLOSE);
    router.push(path.ACTIVITY);
  }, [router, setModal]);

  const title = useMemo(() => {
    if (isTransactionStatus) return undefined;
    return 'Swap';
  }, [isTransactionStatus]);

  const contentKey = useMemo(() => {
    if (isTransactionStatus) return 'transaction-status';
    return 'swap-form';
  }, [isTransactionStatus]);

  const handleAcceptSwapDisclaimer = useCallback(() => {
    acceptDisclaimer('swap');
  }, [acceptDisclaimer]);

  const content = useMemo(() => {
    if (!isSwapAvailable) {
      return <GeoRestrictionNotice feature="swap" />;
    }

    if (!hasAcceptedSwapDisclaimer) {
      return <ExchangeDisclaimer feature="swap" onAccept={handleAcceptSwapDisclaimer} />;
    }

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

    return (
      <View className="flex flex-col gap-4 md:gap-6">
        <SwapPair />
        <SwapParams />
        <View className="mt-2">
          <SwapButton />
        </View>
        <View className="items-center pt-2">
          <NeedHelp />
        </View>
      </View>
    );
  }, [
    isSwapAvailable,
    hasAcceptedSwapDisclaimer,
    handleAcceptSwapDisclaimer,
    isTransactionStatus,
    transaction,
    handleTransactionStatusPress,
  ]);

  return (
    <ResponsiveModal
      currentModal={currentModal}
      previousModal={previousModal}
      isOpen={!isClose}
      onOpenChange={handleOpenChange}
      trigger={null}
      title={title}
      titleClassName="items-center w-full"
      containerClassName="w-full max-w-md"
      showBackButton={false}
      contentKey={contentKey}
    >
      {content}
    </ResponsiveModal>
  );
};

export default SwapModalProvider;
