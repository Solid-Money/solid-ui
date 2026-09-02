import { useCallback, useEffect, useMemo, useRef } from 'react';
import { BottomSheetBackdrop, BottomSheetModal, BottomSheetView } from '@gorhom/bottom-sheet';

import UpgradeTierSheetContent from './UpgradeTierSheetContent';

import type { UpgradeTierSheetProps } from './UpgradeTierSheet.types';

const FIGMA_SHEET_HEIGHT = 412;

const UpgradeTierSheet = ({
  open,
  tier,
  onOpenChange,
  onDepositFuse,
  onBuyFuse,
}: UpgradeTierSheetProps) => {
  const sheetRef = useRef<BottomSheetModal>(null);
  const snapPoints = useMemo(() => [FIGMA_SHEET_HEIGHT], []);

  useEffect(() => {
    if (open) sheetRef.current?.present();
    else sheetRef.current?.dismiss();
  }, [open]);

  const renderBackdrop = useCallback(
    (props: React.ComponentProps<typeof BottomSheetBackdrop>) => (
      <BottomSheetBackdrop
        {...props}
        opacity={0.8}
        appearsOnIndex={0}
        disappearsOnIndex={-1}
        pressBehavior="close"
      />
    ),
    [],
  );

  return (
    <BottomSheetModal
      ref={sheetRef}
      snapPoints={snapPoints}
      enableDynamicSizing={false}
      enablePanDownToClose
      backdropComponent={renderBackdrop}
      backgroundStyle={{
        backgroundColor: '#1C1C1C',
        borderTopLeftRadius: 40,
        borderTopRightRadius: 40,
      }}
      handleStyle={{ paddingBottom: 0, paddingTop: 20 }}
      handleIndicatorStyle={{
        backgroundColor: 'rgba(255,255,255,0.2)',
        width: 73,
        height: 5,
      }}
      onDismiss={() => onOpenChange(false)}
    >
      <BottomSheetView>
        <UpgradeTierSheetContent tier={tier} onDepositFuse={onDepositFuse} onBuyFuse={onBuyFuse} />
      </BottomSheetView>
    </BottomSheetModal>
  );
};

export default UpgradeTierSheet;
