import { useCallback, useEffect, useState } from 'react';
import { BackHandler, Platform } from 'react-native';

import BorrowPositionSheet from '@/components/Card/NewCardDetails/SpendMode/BorrowPositionSheet';
import CollateralHelpSheet from '@/components/Card/NewCardDetails/SpendMode/CollateralHelpSheet';
import SpendModeHelpModal from '@/components/Card/NewCardDetails/SpendMode/SpendModeHelpModal';
import SpendModeSheet from '@/components/Card/NewCardDetails/SpendMode/SpendModeSheet';
import WirexCardFundModal from '@/components/Card/WirexCardFundModal';
import { useCardDetails } from '@/hooks/useCardDetails';
import { useCardProvider } from '@/hooks/useCardProvider';
import { useCustomer } from '@/hooks/useCustomer';
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
  const openSpendMode = useCardPaneStore(state => state.openSpendMode);
  const closeSpendMode = useCardPaneStore(state => state.closeSpendMode);
  const selectedUserId = useUserStore(state => state.users.find(user => user.selected)?.userId);
  const hasShownHelp = useSpendModeHelpStore(
    state => !selectedUserId || Boolean(state.shownByUserId[selectedUserId]),
  );
  const markHelpShown = useSpendModeHelpStore(state => state.markShown);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [isCollateralHelpOpen, setIsCollateralHelpOpen] = useState(false);
  const [isFundOpen, setIsFundOpen] = useState(false);
  const [isCreditDetailsOpen, setIsCreditDetailsOpen] = useState(false);
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
      setIsCollateralHelpOpen(false);
      if (isOpen) closeSpendMode();
      return;
    }
    // Introduce the selector once per account/device; the help button stays available.
    if (selectedUserId && !hasShownHelp) {
      markHelpShown(selectedUserId);
      setIsHelpOpen(true);
    }
  }, [isOpen, figures.canChangeMode, selectedUserId, hasShownHelp, markHelpShown, closeSpendMode]);

  useEffect(() => {
    if (Platform.OS !== 'android' || !isOpen) return;
    // Dismiss the selector before a hardware Back can close the card pane beneath it, and the
    // collateral explainer before the selector it was opened from.
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (isCollateralHelpOpen) setIsCollateralHelpOpen(false);
      else closeSpendMode();
      return true;
    });
    return () => subscription.remove();
  }, [isOpen, isCollateralHelpOpen, closeSpendMode]);

  const onOpenChange = useCallback(
    (open: boolean) => (open ? openSpendMode() : closeSpendMode()),
    [openSpendMode, closeSpendMode],
  );
  const openFunds = useCallback(() => {
    // Close the selector first so finishing the funding flow returns to its origin.
    setIsCollateralHelpOpen(false);
    closeSpendMode();
    setIsFundOpen(true);
  }, [closeSpendMode]);
  const openCreditDetails = useCallback(() => {
    // Handed over like funding: the borrow position has its own Repay steps and keyboard, and
    // stacked over the selector it would leave two sheets to back out of.
    setIsCollateralHelpOpen(false);
    closeSpendMode();
    setIsCreditDetailsOpen(true);
  }, [closeSpendMode]);

  return (
    <>
      <SpendModeSheet
        isOpen={isOpen && figures.canChangeMode}
        onOpenChange={onOpenChange}
        activeMode={figures.mode}
        onHelpPress={() => setIsHelpOpen(true)}
        onCollateralHelpPress={() => setIsCollateralHelpOpen(true)}
        onViewCreditDetails={openCreditDetails}
        onAddFunds={canAddFunds ? openFunds : undefined}
      />
      <SpendModeHelpModal isOpen={isOpen && isHelpOpen} onClose={() => setIsHelpOpen(false)} />
      <CollateralHelpSheet
        isOpen={isOpen && isCollateralHelpOpen}
        onOpenChange={setIsCollateralHelpOpen}
      />
      <WirexCardFundModal isOpen={isFundOpen} onOpenChange={setIsFundOpen} />
      <BorrowPositionSheet isOpen={isCreditDetailsOpen} onOpenChange={setIsCreditDetailsOpen} />
    </>
  );
};

export default SpendModeModals;
