import { BottomSheetModal, BottomSheetView } from '@gorhom/bottom-sheet';
import React, { useCallback, useRef } from 'react';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { TransactionType } from '@/lib/types';

import {
  pressTransactionCredenzaContent,
  TransactionCancelContent,
  TransactionCredenzaContent,
  TransactionCredenzaTrigger,
} from './TransactionCredenza';

interface TransactionDrawerProps {
  url?: string;
  showCancelButton?: boolean;
  onCancelWithdraw?: () => void;
  type?: TransactionType;
  onPress?: () => void;
}

const TransactionDrawer = ({
  url,
  showCancelButton,
  onCancelWithdraw,
  type,
  onPress,
}: TransactionDrawerProps) => {
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
            className="w-full flex-row items-center gap-2 rounded-xl bg-card p-4"
            onPress={() => {
              if (type === TransactionType.BANK_TRANSFER && onPress) {
                onPress();
              } else if (url) {
                pressTransactionCredenzaContent(url);
              }
            }}
          >
            <TransactionCredenzaContent
              text={type === TransactionType.BANK_TRANSFER ? 'View details' : 'View transaction'}
            />
          </Pressable>
          {showCancelButton && (
            <Pressable
              className="w-full flex-row items-center gap-2 rounded-xl bg-card p-4"
              onPress={onCancelWithdraw}
            >
              <TransactionCancelContent />
            </Pressable>
          )}
        </BottomSheetView>
      </BottomSheetModal>
    </View>
  );
};

export default TransactionDrawer;
