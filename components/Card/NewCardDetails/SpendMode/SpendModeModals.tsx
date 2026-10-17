import { useCallback, useEffect, useState } from 'react';
import { BackHandler, Platform } from 'react-native';

import SpendModeHelpModal from '@/components/Card/NewCardDetails/SpendMode/SpendModeHelpModal';
import SpendModeSheet from '@/components/Card/NewCardDetails/SpendMode/SpendModeSheet';
import WirexCardFundModal from '@/components/Card/WirexCardFundModal';
import { useCardDetails } from '@/hooks/useCardDetails';
import { useCardProvider } from '@/hooks/useCardProvider';
import { CardStatus } from '@/lib/types';
import { canAddFundsToCard, canDepositToCard } from '@/lib/utils/cardHelpers';
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
  const [isFundOpen, setIsFundOpen] = useState(false);
  const { data: cardDetails } = useCardDetails();
  const { provider } = useCardProvider();
  const canAddFunds =
    canAddFundsToCard({
      isCardFrozen: cardDetails?.status === CardStatus.FROZEN,
      provider,
    }) && !canDepositToCard(provider);

  useEffect(() => {
    if (!isOpen || !figures.canChangeMode) {
      setIsHelpOpen(false);
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
    // Dismiss the selector before a hardware Back can close the card pane beneath it.
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      closeSpendMode();
      return true;
    });
    return () => subscription.remove();
  }, [isOpen, closeSpendMode]);

  const onOpenChange = useCallback(
    (open: boolean) => (open ? openSpendMode() : closeSpendMode()),
    [openSpendMode, closeSpendMode],
  );
  const openFunds = useCallback(() => {
    // Close the selector first so finishing the funding flow returns to its origin.
    closeSpendMode();
    setIsFundOpen(true);
  }, [closeSpendMode]);

  return (
    <>
      <SpendModeSheet
        isOpen={isOpen && figures.canChangeMode}
        onOpenChange={onOpenChange}
        activeMode={figures.mode}
        onHelpPress={() => setIsHelpOpen(true)}
        onAddFunds={canAddFunds ? openFunds : undefined}
      />
      <SpendModeHelpModal isOpen={isOpen && isHelpOpen} onClose={() => setIsHelpOpen(false)} />
      <WirexCardFundModal isOpen={isFundOpen} onOpenChange={setIsFundOpen} />
    </>
  );
};

export default SpendModeModals;
