import { useCallback, useRef } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BottomSheetBackdrop, BottomSheetModal, BottomSheetView } from '@gorhom/bottom-sheet';

import { Text } from '@/components/ui/text';
import { CARD_DEPOSIT_MODAL } from '@/constants/modals';
import { useWirexUnifiedBalances } from '@/hooks/useWirexBankAccounts';
import { useCardDepositStore } from '@/store/useCardDepositStore';

import {
  BalanceBreakdownRows,
  type OtherBalances,
  OtherBalancesPill,
  useCardBalanceDisplay,
} from '.';

/**
 * Native balances control: a pill (Wallet/Card/Savings donut + total) that
 * presents a Gorhom bottom sheet with the balances broken out. Mirrors
 * InfoCenterDropdown.native.tsx.
 */
const OtherBalancesDropdown = ({
  walletBalance,
  cardBalance,
  savingsBalance,
  userHasCard,
  isLoading,
}: OtherBalances) => {
  const insets = useSafeAreaInsets();
  const bottomSheetModalRef = useRef<BottomSheetModal>(null);
  const shouldOpenCardDepositRef = useRef(false);
  // A Wirex card has no balance of its own, so it gets a Spendable row and no
  // "Add" — see `cardHoldsBalance` / `canDepositToCard`.
  const { cardHoldsOwnBalance, canAddToCard, spendableBalance } = useCardBalanceDisplay();
  // Money received by SEPA/ACH and still sitting at Wirex. Empty for everyone
  // without a Wirex bank account, so the rows simply do not appear.
  const { balances: bankBalances } = useWirexUnifiedBalances();

  const present = useCallback(() => bottomSheetModalRef.current?.present(), []);
  const dismiss = useCallback(() => bottomSheetModalRef.current?.dismiss(), []);
  const openCardDeposit = useCallback(() => {
    shouldOpenCardDepositRef.current = true;
    dismiss();
  }, [dismiss]);
  // "Add" only shows on a card that holds a balance, i.e. Rain — so this opens
  // the older deposit screens those cardholders keep (`usesNewDepositDesign`).
  // Deferred to the dismiss so the sheet is gone before the modal arrives.
  const setCardDepositModal = useCardDepositStore(state => state.setModal);
  const handleDismiss = useCallback(() => {
    if (!shouldOpenCardDepositRef.current) return;
    shouldOpenCardDepositRef.current = false;
    setCardDepositModal(CARD_DEPOSIT_MODAL.OPEN_INTERNAL_FORM);
  }, [setCardDepositModal]);

  const renderBackdrop = useCallback(
    (props: any) => <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} />,
    [],
  );

  return (
    <View className="items-center">
      <OtherBalancesPill
        walletValue={walletBalance}
        // Zero for a card with no balance of its own: its reported figure is a
        // slice of savings, so a segment for it would draw the same money twice.
        cardValue={cardHoldsOwnBalance ? cardBalance : 0}
        savingsValue={savingsBalance}
        onPress={present}
      />
      <BottomSheetModal
        ref={bottomSheetModalRef}
        onDismiss={handleDismiss}
        backdropComponent={renderBackdrop}
        backgroundStyle={{ backgroundColor: '#1c1c1c', borderRadius: 20 }}
        handleIndicatorStyle={{
          backgroundColor: 'rgba(255,255,255,0.2)',
          width: 74,
          height: 8,
        }}
      >
        <BottomSheetView className="gap-1 pb-2 pt-1" style={{ paddingBottom: insets.bottom + 8 }}>
          <Text className="px-5 pb-1 text-lg font-semibold text-muted-foreground">Balances</Text>
          <BalanceBreakdownRows
            walletBalance={walletBalance}
            cardBalance={cardBalance}
            savingsBalance={savingsBalance}
            userHasCard={userHasCard}
            isLoading={isLoading}
            onDismiss={dismiss}
            onCardAdd={openCardDeposit}
            cardHoldsOwnBalance={cardHoldsOwnBalance}
            canAddToCard={canAddToCard}
            spendableBalance={spendableBalance}
            bankBalances={bankBalances}
          />
        </BottomSheetView>
      </BottomSheetModal>
    </View>
  );
};

export default OtherBalancesDropdown;
