import { useCallback, useEffect, useState } from 'react';
import { BackHandler, Platform } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useIsFocused } from '@react-navigation/native';

import SpendModeHelpModal from '@/components/Card/NewCardDetails/SpendMode/SpendModeHelpModal';
import SpendModeSheet from '@/components/Card/NewCardDetails/SpendMode/SpendModeSheet';
import WirexCardFundModal from '@/components/Card/WirexCardFundModal';
import { CREDIT_SOURCE_SPEND_MODE, path } from '@/constants/path';
import { useCardDetails } from '@/hooks/useCardDetails';
import { useCardProvider } from '@/hooks/useCardProvider';
import { useCustomer } from '@/hooks/useCustomer';
import { useSpendOrder } from '@/hooks/useSpendOrder';
import { CardStatus } from '@/lib/types';
import {
  canAddFundsToCard,
  canDepositToCard,
  isCustomerFundsRestricted,
} from '@/lib/utils/cardHelpers';
import { useCardPaneStore } from '@/store/useCardPaneStore';
import { useSpendModeHelpStore } from '@/store/useSpendModeHelpStore';
import { useUserStore } from '@/store/useUserStore';

import type { SpendModeFigures } from '@/components/Card/NewCardDetails/SpendMode/useSpendModeFigures';

/** Shared selector and its follow-up flows, presented above Home or card details. */
const SpendModeModals = ({
  figures,
}: {
  figures: Pick<SpendModeFigures, 'mode' | 'canChangeMode'>;
}) => {
  const isOpen = useCardPaneStore(state => state.isSpendModeOpen);
  const isFocused = useIsFocused();
  const openSpendMode = useCardPaneStore(state => state.openSpendMode);
  const closeSpendMode = useCardPaneStore(state => state.closeSpendMode);
  const selectedUserId = useUserStore(state => state.users.find(user => user.selected)?.userId);
  const hasShownHelp = useSpendModeHelpStore(
    state => !selectedUserId || Boolean(state.shownByUserId[selectedUserId]),
  );
  const markHelpShown = useSpendModeHelpStore(state => state.markShown);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [isFundOpen, setIsFundOpen] = useState(false);
  const [restoreCreditPreview, setRestoreCreditPreview] = useState(false);
  const { data: cardDetails } = useCardDetails();
  const { data: customer } = useCustomer();
  const { provider } = useCardProvider();
  const canAddFunds =
    canAddFundsToCard({
      isCardFrozen: cardDetails?.status === CardStatus.FROZEN,
      isCustomerRestricted: isCustomerFundsRestricted(customer?.status),
      provider,
    }) && !canDepositToCard(provider);

  useEffect(() => {
    if (!isOpen || !figures.canChangeMode) {
      setIsHelpOpen(false);
      setRestoreCreditPreview(false);
      if (isOpen) closeSpendMode();
      return;
    }
    // Introduce the selector once per account/device; the help button stays available.
    if (selectedUserId && !hasShownHelp) {
      markHelpShown(selectedUserId);
      setIsHelpOpen(true);
    }
  }, [isOpen, figures.canChangeMode, selectedUserId, hasShownHelp, markHelpShown, closeSpendMode]);

  useFocusEffect(
    useCallback(() => {
      if (Platform.OS !== 'android' || !isOpen) return;
      // The selector owns Back while its Home screen is focused.
      const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
        closeSpendMode();
        return true;
      });
      return () => subscription.remove();
    }, [isOpen, closeSpendMode]),
  );

  const onOpenChange = useCallback(
    (open: boolean) => (open ? openSpendMode() : closeSpendMode()),
    [openSpendMode, closeSpendMode],
  );
  const openFunds = useCallback(() => {
    // Close the selector first so finishing the funding flow returns to its origin.
    closeSpendMode();
    setIsFundOpen(true);
  }, [closeSpendMode]);
  const openCreditDetails = useCallback(() => {
    setRestoreCreditPreview(true);
    router.push({ pathname: '/card/credit', params: { source: CREDIT_SOURCE_SPEND_MODE } });
  }, []);

  // The backend's `canEdit` gates the Spend order entry.
  const { canEdit: canEditSpendOrder } = useSpendOrder();

  const openSpendOrder = useCallback(() => {
    // Closed first, like funding, so backing out of the screen lands on the card, not the sheet.
    closeSpendMode();
    router.push(path.CARD_SPEND_ORDER);
  }, [closeSpendMode]);

  return (
    <>
      <SpendModeSheet
        isOpen={isOpen && figures.canChangeMode}
        isSuspended={!isFocused}
        onOpenChange={onOpenChange}
        activeMode={figures.mode}
        initialMode={restoreCreditPreview ? 'credit' : figures.mode}
        onHelpPress={() => setIsHelpOpen(true)}
        onViewCreditDetails={openCreditDetails}
        onAddFunds={canAddFunds ? openFunds : undefined}
        onEditOrder={canEditSpendOrder ? openSpendOrder : undefined}
      />
      <SpendModeHelpModal
        isOpen={isOpen && isFocused && isHelpOpen}
        onClose={() => setIsHelpOpen(false)}
      />
      <WirexCardFundModal isOpen={isFundOpen} onOpenChange={setIsFundOpen} />
    </>
  );
};

export default SpendModeModals;
