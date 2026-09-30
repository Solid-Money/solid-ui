import React, { useCallback, useMemo, useRef, useState } from 'react';
import { useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BottomSheetBackdrop, BottomSheetModal, BottomSheetScrollView } from '@gorhom/bottom-sheet';

import { RewardsTier } from '@/lib/types';

import SubscriptionCashbackContent from './SubscriptionCashbackContent';

import type { SubscriptionCashbackSheetProps } from './SubscriptionCashbackSheet.types';

const SubscriptionCashbackSheet = ({
  trigger,
  onGetMoreCashback,
  onUpgradeTier,
  triggerContainerClassName = 'flex-1',
  ...subscriptionData
}: SubscriptionCashbackSheetProps) => {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const sheetRef = useRef<BottomSheetModal>(null);
  // Categories with five merchants still scroll on smaller phones.
  const snapPoints = useMemo(() => [Math.min(784, height * 0.9)], [height]);
  const [animationSession, setAnimationSession] = useState(0);

  const present = useCallback(() => {
    setAnimationSession(session => session + 1);
    sheetRef.current?.present();
  }, []);
  const dismiss = useCallback(() => sheetRef.current?.dismiss(), []);
  const handleGetMoreCashback = useCallback(() => {
    dismiss();
    if (onUpgradeTier) {
      onUpgradeTier(
        subscriptionData.currentTier === RewardsTier.CORE ? RewardsTier.PRIME : RewardsTier.ULTRA,
      );
    } else {
      onGetMoreCashback();
    }
  }, [dismiss, onGetMoreCashback, onUpgradeTier, subscriptionData.currentTier]);

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
          contentContainerStyle={{ paddingBottom: insets.bottom }}
        >
          <SubscriptionCashbackContent
            key={animationSession}
            {...subscriptionData}
            animationSession={animationSession}
            sheetTopPadding={39}
            onGetMoreCashback={handleGetMoreCashback}
            onDismiss={dismiss}
          />
        </BottomSheetScrollView>
      </BottomSheetModal>
    </View>
  );
};

export default SubscriptionCashbackSheet;
