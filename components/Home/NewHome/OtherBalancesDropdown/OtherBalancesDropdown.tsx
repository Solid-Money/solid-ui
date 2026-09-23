import { useState } from 'react';
import { View } from 'react-native';

import { Dialog, DialogContent, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
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
 * Default / web-mobile balances control. Gorhom bottom sheets are native-only in
 * this repo (see InfoCenterDropdown.web.tsx), so the base variant uses the Dialog
 * primitive; the native override lives in OtherBalancesDropdown.native.tsx.
 */
const OtherBalancesDropdown = ({
  walletBalance,
  cardBalance,
  savingsBalance,
  userHasCard,
  isLoading,
}: OtherBalances) => {
  const [open, setOpen] = useState(false);
  // A Wirex card has no balance of its own, so it gets a Spendable row and no
  // "Add" — see `cardHoldsBalance` / `canDepositToCard`.
  const { cardHoldsOwnBalance, canAddToCard, spendableBalance } = useCardBalanceDisplay();
  // Money received by SEPA/ACH and still sitting at Wirex. Empty for everyone
  // without a Wirex bank account, so the rows simply do not appear.
  const { balances: bankBalances } = useWirexUnifiedBalances();
  const dismiss = () => setOpen(false);
  // "Add" only shows on a card that holds a balance, i.e. Rain — so this opens
  // the older deposit screens those cardholders keep (`usesNewDepositDesign`).
  const setCardDepositModal = useCardDepositStore(state => state.setModal);
  const openCardDeposit = () => {
    dismiss();
    setCardDepositModal(CARD_DEPOSIT_MODAL.OPEN_INTERNAL_FORM);
  };

  return (
    <View className="items-center">
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <OtherBalancesPill
            walletValue={walletBalance}
            // Zero for a card with no balance of its own: its reported figure is a
            // slice of savings, so a segment for it would draw the same money twice.
            cardValue={cardHoldsOwnBalance ? cardBalance : 0}
            savingsValue={savingsBalance}
          />
        </DialogTrigger>
        <DialogContent className="gap-1 p-4">
          <DialogTitle className="px-2 pb-1 text-lg text-muted-foreground">Balances</DialogTitle>
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
        </DialogContent>
      </Dialog>
    </View>
  );
};

export default OtherBalancesDropdown;
