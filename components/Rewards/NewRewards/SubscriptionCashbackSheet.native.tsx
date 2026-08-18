import React, { useCallback, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BottomSheetBackdrop, BottomSheetModal, BottomSheetScrollView } from '@gorhom/bottom-sheet';

import SubscriptionCashbackContent from './SubscriptionCashbackContent';

import type { SubscriptionCashbackSheetProps } from './SubscriptionCashbackSheet.types';

const SubscriptionCashbackSheet = ({
  trigger,
  onGetMoreCashback,
  triggerContainerClassName = 'flex-1',
  ...subscriptionData
}: SubscriptionCashbackSheetProps) => {
  const insets = useSafeAreaInsets();
  const sheetRef = useRef<BottomSheetModal>(null);
  // Eleven merchant rows across three cards — this one runs nearly full height
  // and scrolls, unlike the shorter cashback and yield boost sheets.
  const snapPoints = useMemo(() => ['90%'], []);
  const [animationSession, setAnimationSession] = useState(0);

  const present = useCallback(() => {
    setAnimationSession(session => session + 1);
    sheetRef.current?.present();
  }, []);
  const dismiss = useCallback(() => sheetRef.current?.dismiss(), []);
  const handleGetMoreCashback = useCallback(() => {
    dismiss();
    onGetMoreCashback();
  }, [dismiss, onGetMoreCashback]);

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
    <View className={triggerContainerClassName}>
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
          <SubscriptionCashbackContent
            {...subscriptionData}
            animationSession={animationSession}
            onGetMoreCashback={handleGetMoreCashback}
          />
        </BottomSheetScrollView>
      </BottomSheetModal>
    </View>
  );
};

export default SubscriptionCashbackSheet;
