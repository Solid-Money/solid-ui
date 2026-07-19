import { useCallback, useRef } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BottomSheetBackdrop, BottomSheetModal, BottomSheetView } from '@gorhom/bottom-sheet';

import { Text } from '@/components/ui/text';

import {
  CardBalanceRow,
  getOtherBalancesTotal,
  type OtherBalances,
  OtherBalancesPill,
  SavingsBalanceRow,
  shouldShowCard,
} from '.';

/**
 * Native "other balances" control: a pill that presents a Gorhom bottom sheet
 * listing Card + Savings balances. Mirrors InfoCenterDropdown.native.tsx.
 */
const OtherBalancesDropdown = ({
  cardBalance,
  savingsBalance,
  userHasCard,
  isLoading,
}: OtherBalances) => {
  const insets = useSafeAreaInsets();
  const bottomSheetModalRef = useRef<BottomSheetModal>(null);
  const total = getOtherBalancesTotal({ cardBalance, savingsBalance, userHasCard });

  const present = useCallback(() => bottomSheetModalRef.current?.present(), []);
  const dismiss = useCallback(() => bottomSheetModalRef.current?.dismiss(), []);

  const renderBackdrop = useCallback(
    (props: any) => <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} />,
    [],
  );

  return (
    <View className="items-center">
      <OtherBalancesPill
        total={total}
        cardValue={cardBalance}
        savingsValue={savingsBalance}
        onPress={present}
      />
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
          {shouldShowCard(cardBalance, userHasCard) && (
            <CardBalanceRow cardBalance={cardBalance} isLoading={isLoading} onDismiss={dismiss} />
          )}
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
