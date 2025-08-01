import { BottomSheetModal, BottomSheetView } from '@gorhom/bottom-sheet';
import React, { useCallback, useRef } from 'react';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  pressTransactionCredenzaContent,
  TransactionCredenzaContent,
  TransactionCredenzaTrigger,
} from './TransactionCredenza';

interface TransactionDrawerProps {
  url?: string;
}

const TransactionDrawer = ({ url }: TransactionDrawerProps) => {
  const insets = useSafeAreaInsets();
  const bottomSheetModalRef = useRef<BottomSheetModal>(null);

  const handlePresentModalPress = useCallback(() => {
    bottomSheetModalRef.current?.present();
  }, []);

  return (
    <View>
      <TransactionCredenzaTrigger onPress={handlePresentModalPress} />
      <BottomSheetModal
        ref={bottomSheetModalRef}
        backgroundStyle={{
          backgroundColor: 'black',
        }}
        handleIndicatorStyle={{
          backgroundColor: 'white',
        }}
      >
        <BottomSheetView
          className="px-4"
          style={{
            paddingBottom: insets.bottom,
          }}
        >
          <Pressable
            className="w-full flex-row items-center gap-2 bg-card p-4 rounded-xl"
            onPress={() => pressTransactionCredenzaContent(url)}
          >
            <TransactionCredenzaContent />
          </Pressable>
        </BottomSheetView>
      </BottomSheetModal>
    </View>
  );
};

export default TransactionDrawer;
