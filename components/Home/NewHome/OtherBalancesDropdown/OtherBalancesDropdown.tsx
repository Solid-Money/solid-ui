import { useState } from 'react';
import { View } from 'react-native';

import CardDirectDepositModal from '@/components/Card/CardDirectDepositModal';
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useCardProvider } from '@/hooks/useCardProvider';
import { canDepositToCard } from '@/lib/utils/cardHelpers';

import { BalanceBreakdownRows, type OtherBalances, OtherBalancesPill } from '.';

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
  const [isCardDepositOpen, setIsCardDepositOpen] = useState(false);
  // A Wirex card has no balance to deposit into — see `canDepositToCard`.
  const { provider } = useCardProvider();
  const canAddToCard = canDepositToCard(provider);
  const dismiss = () => setOpen(false);
  const openCardDeposit = () => {
    dismiss();
    setIsCardDepositOpen(true);
  };

  return (
    <View className="items-center">
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <OtherBalancesPill
            walletValue={walletBalance}
            cardValue={cardBalance}
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
            canAddToCard={canAddToCard}
          />
        </DialogContent>
      </Dialog>
      <CardDirectDepositModal
        trigger={null}
        isOpen={isCardDepositOpen}
        onOpenChange={setIsCardDepositOpen}
      />
    </View>
  );
};

export default OtherBalancesDropdown;
