import React, { useCallback, useMemo } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { useShallow } from 'zustand/react/shallow';

import ExchangeDisclaimer from '@/components/Compliance/ExchangeDisclaimer';
import GeoRestrictionNotice from '@/components/Compliance/GeoRestrictionNotice';
import NeedHelp from '@/components/NeedHelp';
import ResponsiveModal from '@/components/ResponsiveModal';
import BuyFuseScreen from '@/components/Swap/BuyFuseScreen';
import LifiSwapButton from '@/components/Swap/lifi/LifiSwapButton';
import LifiSwapPair from '@/components/Swap/lifi/LifiSwapPair';
import LifiSwapParams from '@/components/Swap/lifi/LifiSwapParams';
import LifiSwapStatusView from '@/components/Swap/lifi/LifiSwapStatusView';
import LifiSwapStatusWatcher from '@/components/Swap/lifi/LifiSwapStatusWatcher';
import SwapButton from '@/components/Swap/SwapButton';
import SwapPair from '@/components/Swap/SwapPair';
import SwapParams from '@/components/Swap/SwapParams';
import TransactionStatus from '@/components/TransactionStatus';
import { SWAP_MODAL } from '@/constants/modals';
import { path } from '@/constants/path';
import { TRACKING_EVENTS } from '@/constants/tracking-events';
import { LifiSwapInfoProvider } from '@/hooks/swap/useLifiSwapInfo';
import useGeoCompliance from '@/hooks/useGeoCompliance';
import { track } from '@/lib/analytics';
import getTokenIcon from '@/lib/getTokenIcon';
import { DerivedSwapInfoProvider, useIsLifiSwap, useSwapState } from '@/store/swapStore';
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
      hasAcceptedSwapDisclaimer: state.hasAcceptedDisclaimer('swap'),
      acceptDisclaimer: state.acceptDisclaimer,
    })),
  );

  const { currentModal, previousModal, transaction, buyFuseTier, buyFuseUpgrade, setModal } =
    useSwapState(
      useShallow(state => ({
        currentModal: state.currentModal ?? SWAP_MODAL.CLOSE,
        previousModal: state.previousModal ?? SWAP_MODAL.CLOSE,
        transaction: state.transaction,
        buyFuseTier: state.buyFuseTier,
        buyFuseUpgrade: state.buyFuseUpgrade,
        setModal: state.actions.setModal,
      })),
    );

  const isLifiSwap = useIsLifiSwap();
  const isTransactionStatus = currentModal.name === SWAP_MODAL.OPEN_TRANSACTION_STATUS.name;
  const isLifiStatus = currentModal.name === SWAP_MODAL.OPEN_LIFI_STATUS.name;
  const isBuyFuse = currentModal.name === SWAP_MODAL.OPEN_BUY_FUSE.name;
  const isClose = currentModal.name === SWAP_MODAL.CLOSE.name;
  const isBuyFuseContent = isBuyFuse && isSwapAvailable && hasAcceptedSwapDisclaimer;

  const handleOpenChange = useCallback(
    (value: boolean) => {
      if (value) {
        track(TRACKING_EVENTS.SWAP_MODAL_VIEWED, {
          previous_modal: previousModal.name,
        });
        setModal(SWAP_MODAL.OPEN_FORM);
      } else {
        track(TRACKING_EVENTS.SWAP_MODAL_ABANDONED, {
          last_modal: currentModal?.name,
          previous_modal: previousModal.name,
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
    if (isTransactionStatus || isLifiStatus) return undefined;
    return isBuyFuse ? 'Buy FUSE' : 'Swap';
  }, [isBuyFuse, isTransactionStatus, isLifiStatus]);

  const contentKey = useMemo(() => {
    if (isTransactionStatus) return 'transaction-status';
    if (isLifiStatus) return 'lifi-status';
    if (isBuyFuse) return 'buy-fuse';
    return isLifiSwap ? 'swap-form-lifi' : 'swap-form';
  }, [isBuyFuse, isTransactionStatus, isLifiStatus, isLifiSwap]);

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

    if (isBuyFuse) {
      return (
        <DerivedSwapInfoProvider>
          <BuyFuseScreen requestedTier={buyFuseTier} upgradeContext={buyFuseUpgrade} />
        </DerivedSwapInfoProvider>
      );
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

    if (isLifiStatus) {
      return <LifiSwapStatusView onDone={handleTransactionStatusPress} />;
    }

    // Fuse to Fuse is quoted and routed on Algebra; a pair that touches any
    // other chain goes through LI.FI.
    if (isLifiSwap) {
      return (
        <LifiSwapInfoProvider>
          <View className="flex flex-col gap-4 md:gap-6">
            <LifiSwapPair />
            <LifiSwapParams />
            <View className="mt-2">
              <LifiSwapButton />
            </View>
            <View className="items-center pt-2">
              <NeedHelp />
            </View>
          </View>
        </LifiSwapInfoProvider>
      );
    }

    return (
      <DerivedSwapInfoProvider>
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
      </DerivedSwapInfoProvider>
    );
  }, [
    isLifiStatus,
    isLifiSwap,
    isSwapAvailable,
    hasAcceptedSwapDisclaimer,
    handleAcceptSwapDisclaimer,
    isBuyFuse,
    buyFuseTier,
    buyFuseUpgrade,
    isTransactionStatus,
    transaction,
    handleTransactionStatusPress,
  ]);

  return (
    <>
      <LifiSwapStatusWatcher />
      <ResponsiveModal
        currentModal={currentModal}
        previousModal={previousModal}
        isOpen={!isClose}
        onOpenChange={handleOpenChange}
        trigger={null}
        title={title}
        titleClassName="items-center w-full"
        containerClassName="w-full max-w-md"
        showBackButton={isBuyFuse}
        onBackPress={isBuyFuse ? () => handleOpenChange(false) : undefined}
        contentKey={contentKey}
        disableScroll={isBuyFuseContent}
      >
        {content}
      </ResponsiveModal>
    </>
  );
};

export default SwapModalProvider;
