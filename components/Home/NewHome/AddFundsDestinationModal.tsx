import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View } from 'react-native';

import HomeCard from '@/assets/images/home-card';
import WalletIcon from '@/assets/images/wallet';
import CardDirectDepositModal from '@/components/Card/CardDirectDepositModal';
import DepositOption from '@/components/DepositOption/DepositOption';
import NeedHelp from '@/components/NeedHelp';
import ResponsiveModal, { ModalState } from '@/components/ResponsiveModal';
import SlotTrigger from '@/components/SlotTrigger';
import { useOpenDepositFlow } from '@/hooks/useOpenDepositFlow';

const CLOSE_STATE: ModalState = { name: 'close', number: -1 };
const OPTIONS_STATE: ModalState = { name: 'options', number: 0 };

/**
 * Wait out this popup's exit animation (dialog content fades out over 180ms)
 * before opening the next one. Mounting the next dialog in the same commit as
 * this one unmounts leaves the closing sheet's view in the native hierarchy on
 * top of the new dialog, which swallows its taps — the close button appeared
 * dead. Handing over on a later tick keeps one dialog on screen at a time.
 */
const HANDOFF_DELAY_MS = 260;

interface AddFundsDestinationModalProps {
  trigger: React.ReactNode;
}

/**
 * Destination picker shown behind home's "Add Funds" button for card holders:
 * the money can go to the card (spendable right away) or to the wallet. Picking
 * one routes to that flow's existing modal — "Fund your card"
 * (CardDirectDepositModal) or the global deposit modal.
 *
 * Users without a card never see this; WalletActions wires "Add Funds" straight
 * to the wallet deposit flow for them.
 */
const AddFundsDestinationModal = ({ trigger }: AddFundsDestinationModalProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isCardDepositOpen, setIsCardDepositOpen] = useState(false);
  const openDepositFlow = useOpenDepositFlow();
  const handoffTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (handoffTimer.current) clearTimeout(handoffTimer.current);
    },
    [],
  );

  // Close this popup, then open the picked flow once it's off screen.
  const handOffTo = useCallback((open: () => void) => {
    setIsOpen(false);
    if (handoffTimer.current) clearTimeout(handoffTimer.current);
    handoffTimer.current = setTimeout(open, HANDOFF_DELAY_MS);
  }, []);

  const handleCardPress = useCallback(
    () => handOffTo(() => setIsCardDepositOpen(true)),
    [handOffTo],
  );

  const handleWalletPress = useCallback(
    () => handOffTo(() => openDepositFlow({ source: 'home_add_funds_destination' })),
    [handOffTo, openDepositFlow],
  );

  return (
    <>
      {/* The trigger is cloned in place (rather than handed to ResponsiveModal,
          which wraps it in a Dialog trigger) so it keeps the layout classes the
          action row gives it — otherwise the "Add Funds" pill loses its flex-1
          width on native. */}
      <SlotTrigger onPress={() => setIsOpen(true)}>{trigger}</SlotTrigger>
      <ResponsiveModal
        currentModal={OPTIONS_STATE}
        previousModal={CLOSE_STATE}
        isOpen={isOpen}
        onOpenChange={setIsOpen}
        trigger={null}
        title="Add funds"
        contentKey="add-funds-destination"
      >
        <View className="gap-y-2.5">
          <DepositOption
            text="Add to card"
            subtitle="Top up your card so you can spend the funds right away"
            icon={<HomeCard width={22} height={19} />}
            onPress={handleCardPress}
          />
          <DepositOption
            text="Add to wallet"
            subtitle="Deposit by bank transfer, card or crypto into your Solid wallet"
            icon={<WalletIcon width={22} height={22} />}
            onPress={handleWalletPress}
          />
          <View className="mt-4 items-center">
            <NeedHelp />
          </View>
        </View>
      </ResponsiveModal>
      <CardDirectDepositModal isOpen={isCardDepositOpen} onOpenChange={setIsCardDepositOpen} />
    </>
  );
};

export default AddFundsDestinationModal;
