import React, { useCallback, useMemo, useRef, useState } from 'react';
import { useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BottomSheetBackdrop, BottomSheetModal, BottomSheetScrollView } from '@gorhom/bottom-sheet';

import TierPointsSheetContent from './TierPointsSheetContent';

import type { TierPointsSheetProps } from './TierPointsSheet.types';

const FIGMA_SHEET_HEIGHT = 792;

const TierPointsSheet = ({ trigger }: TierPointsSheetProps) => {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const sheetRef = useRef<BottomSheetModal>(null);
  const [animationSession, setAnimationSession] = useState(0);
  const snapPoints = useMemo(
    () => [Math.min(FIGMA_SHEET_HEIGHT, height - insets.top - 16)],
    [height, insets.top],
  );

  const present = useCallback(() => {
    setAnimationSession(session => session + 1);
    sheetRef.current?.present();
  }, []);
  const dismiss = useCallback(() => sheetRef.current?.dismiss(), []);

  const renderBackdrop = useCallback(
    (props: any) => (
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
    <View>
      {React.cloneElement(trigger, { onPress: present })}
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
        handleStyle={{ paddingBottom: 0, paddingTop: 16 }}
        handleIndicatorStyle={{
          backgroundColor: 'rgba(255,255,255,0.2)',
          width: 73,
          height: 5,
        }}
      >
        <BottomSheetScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: insets.bottom + 7 }}
        >
          <TierPointsSheetContent animationSession={animationSession} onClose={dismiss} />
        </BottomSheetScrollView>
      </BottomSheetModal>
    </View>
  );
};

export default TierPointsSheet;
