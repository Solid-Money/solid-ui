import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BottomSheetBackdrop, BottomSheetModal, BottomSheetView } from '@gorhom/bottom-sheet';

import { closeSupportDrawer, useSupportDrawerStore } from '@/store/useSupportDrawerStore';

import SupportDrawerContent from './SupportDrawerContent';

const FIGMA_SHEET_HEIGHT = 522;

const SupportDrawerProvider = () => {
  const sheetRef = useRef<BottomSheetModal>(null);
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const isOpen = useSupportDrawerStore(state => state.isOpen);
  const sheetHeight = Math.min(FIGMA_SHEET_HEIGHT, height - insets.top - 8);
  const snapPoints = useMemo(() => [sheetHeight], [sheetHeight]);

  useEffect(() => {
    if (isOpen) {
      sheetRef.current?.present();
    } else {
      sheetRef.current?.dismiss();
    }
  }, [isOpen]);

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
        backgroundColor: '#1c1c1c',
        borderTopLeftRadius: 40,
        borderTopRightRadius: 40,
      }}
      handleComponent={null}
      onDismiss={closeSupportDrawer}
    >
      <BottomSheetView style={{ height: sheetHeight }}>
        <SupportDrawerContent />
      </BottomSheetView>
    </BottomSheetModal>
  );
};

export default SupportDrawerProvider;
