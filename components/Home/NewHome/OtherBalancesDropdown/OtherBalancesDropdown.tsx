import { useState } from 'react';
import { View } from 'react-native';

import { Dialog, DialogContent, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

import {
  CardBalanceRow,
  getOtherBalancesTotal,
  type OtherBalances,
  OtherBalancesPill,
  SavingsBalanceRow,
} from '.';

/**
 * Default / web-mobile "other balances" control. Gorhom bottom sheets are
 * native-only in this repo (see InfoCenterDropdown.web.tsx), so the base
 * variant uses the Dialog primitive; the native override lives in
 * OtherBalancesDropdown.native.tsx.
 */
const OtherBalancesDropdown = ({
  cardBalance,
  savingsBalance,
  userHasCard,
  isLoading,
}: OtherBalances) => {
  const [open, setOpen] = useState(false);
  const total = getOtherBalancesTotal({ cardBalance, savingsBalance, userHasCard });
  const dismiss = () => setOpen(false);

  return (
    <View className="items-center">
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <OtherBalancesPill
            total={total}
            cardValue={userHasCard ? cardBalance : 0}
            savingsValue={savingsBalance}
          />
        </DialogTrigger>
        <DialogContent className="gap-1 p-4">
          <DialogTitle className="px-2 pb-1 text-lg text-muted-foreground">Balances</DialogTitle>
          {userHasCard && (
            <CardBalanceRow cardBalance={cardBalance} isLoading={isLoading} onDismiss={dismiss} />
          )}
          <SavingsBalanceRow
            savingsBalance={savingsBalance}
            isLoading={isLoading}
            onDismiss={dismiss}
          />
        </DialogContent>
      </Dialog>
    </View>
  );
};

export default OtherBalancesDropdown;
