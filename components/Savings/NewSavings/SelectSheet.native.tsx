import React, { useCallback, useRef } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BottomSheetBackdrop, BottomSheetModal, BottomSheetView } from '@gorhom/bottom-sheet';

import { Text } from '@/components/ui/text';

import type { SelectSheetProps } from './SelectSheet.types';

/**
 * Native reusable "pill → bottom sheet" primitive. The pill trigger opens a
 * Gorhom bottom sheet whose body is provided by `children(dismiss)`. Mirrors the
 * OtherBalancesDropdown.native sheet styling so the redesign's sheets match.
 * Web uses the Dialog-based variant in SelectSheet.tsx.
 */
const SelectSheet = ({ trigger, title, children }: SelectSheetProps) => {
  const insets = useSafeAreaInsets();
  const sheetRef = useRef<BottomSheetModal>(null);

  const present = useCallback(() => sheetRef.current?.present(), []);
  const dismiss = useCallback(() => sheetRef.current?.dismiss(), []);

  const renderBackdrop = useCallback(
    (props: any) => <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} />,
    [],
  );

  return (
    <View className="items-center">
      {React.cloneElement(trigger, { onPress: present })}
      <BottomSheetModal
        ref={sheetRef}
        backdropComponent={renderBackdrop}
        backgroundStyle={{ backgroundColor: '#1c1c1c', borderRadius: 20 }}
        handleIndicatorStyle={{
          backgroundColor: 'rgba(255,255,255,0.2)',
          width: 74,
          height: 8,
        }}
      >
        <BottomSheetView className="gap-1 pb-2 pt-1" style={{ paddingBottom: insets.bottom + 8 }}>
          <Text className="px-5 pb-1 text-lg font-semibold text-muted-foreground">{title}</Text>
          {children(dismiss)}
        </BottomSheetView>
      </BottomSheetModal>
    </View>
  );
};

export default SelectSheet;
