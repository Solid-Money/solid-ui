import { useCallback, useRef, useState } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BottomSheetBackdrop, BottomSheetModal, BottomSheetView } from '@gorhom/bottom-sheet';

import CardDirectDepositModal from '@/components/Card/CardDirectDepositModal';
import { Text } from '@/components/ui/text';
import { useCardProvider } from '@/hooks/useCardProvider';
import { canDepositToCard } from '@/lib/utils/cardHelpers';

import { BalanceBreakdownRows, type OtherBalances, OtherBalancesPill } from '.';

/**
 * Native balances control: a pill (total + Wallet/Card/Savings donut) that
 * presents a Gorhom bottom sheet with all three balances broken out. Mirrors
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
  const [isCardDepositOpen, setIsCardDepositOpen] = useState(false);
  // A Wirex card has no balance to deposit into — see `canDepositToCard`.
  const { provider } = useCardProvider();
  const canAddToCard = canDepositToCard(provider);

  const present = useCallback(() => bottomSheetModalRef.current?.present(), []);
  const dismiss = useCallback(() => bottomSheetModalRef.current?.dismiss(), []);
  const openCardDeposit = useCallback(() => {
    shouldOpenCardDepositRef.current = true;
    dismiss();
  }, [dismiss]);
  const handleDismiss = useCallback(() => {
    if (!shouldOpenCardDepositRef.current) return;
    shouldOpenCardDepositRef.current = false;
    setIsCardDepositOpen(true);
  }, []);

  const renderBackdrop = useCallback(
    (props: any) => <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} />,
    [],
  );

  return (
    <View className="items-center">
      <OtherBalancesPill
        walletValue={walletBalance}
        cardValue={cardBalance}
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
            canAddToCard={canAddToCard}
          />
        </BottomSheetView>
      </BottomSheetModal>
      <CardDirectDepositModal
        trigger={null}
        isOpen={isCardDepositOpen}
        onOpenChange={setIsCardDepositOpen}
      />
    </View>
  );
};

export default OtherBalancesDropdown;
