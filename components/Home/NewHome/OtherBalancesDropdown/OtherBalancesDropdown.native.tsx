import { useCallback, useRef } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BottomSheetBackdrop, BottomSheetModal, BottomSheetView } from '@gorhom/bottom-sheet';

import { Text } from '@/components/ui/text';

import {
  type OtherBalances,
  OtherBalancesPill,
  SavingsBalanceRow,
  SpendableBalancesGroup,
} from '.';

/**
 * Native balances control: a pill (savings) that presents a Gorhom bottom sheet
 * with the full breakdown — Wallet + Card (grouped, since they make up the
 * headline) and Savings. Mirrors InfoCenterDropdown.native.tsx.
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

  const present = useCallback(() => bottomSheetModalRef.current?.present(), []);
  const dismiss = useCallback(() => bottomSheetModalRef.current?.dismiss(), []);

  const renderBackdrop = useCallback(
    (props: any) => <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} />,
    [],
  );

  return (
    <View className="items-center">
      <OtherBalancesPill savingsValue={savingsBalance} onPress={present} />
      <BottomSheetModal
        ref={bottomSheetModalRef}
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
          <SpendableBalancesGroup
            walletBalance={walletBalance}
            cardBalance={cardBalance}
            userHasCard={userHasCard}
            isLoading={isLoading}
          />
          <SavingsBalanceRow
            savingsBalance={savingsBalance}
            isLoading={isLoading}
            onDismiss={dismiss}
          />
        </BottomSheetView>
      </BottomSheetModal>
    </View>
  );
};

export default OtherBalancesDropdown;
