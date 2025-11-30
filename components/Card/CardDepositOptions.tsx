import { ChevronRight, Wallet } from 'lucide-react-native';
import React from 'react';
import { Platform, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { CARD_DEPOSIT_MODAL } from '@/constants/modals';
import { useCardDepositStore } from '@/store/useCardDepositStore';

export default function CardDepositOptions() {
  const { setModal, setSource } = useCardDepositStore();

  const Item = ({ text, onPress }: { text: string; onPress: () => void }) => (
    <Button
      variant="ghost"
      className="flex-row items-center justify-between bg-primary/10 rounded-2xl p-6 disabled:opacity-100 disabled:web:hover:opacity-100"
      style={{ height: 78 }}
      onPress={onPress}
    >
      <View className="flex-row items-center gap-3">
        <Wallet color="white" size={24} />
        <Text className="text-lg font-semibold">{text}</Text>
      </View>
      <ChevronRight color="white" size={20} />
    </Button>
  );

  return (
    <View className="gap-y-2.5">
      <Item
        text="From Wallet/Savings"
        onPress={() => {
          setSource('wallet');
          setModal(CARD_DEPOSIT_MODAL.OPEN_INTERNAL_FORM);
        }}
      />
      {Platform.OS === 'web' && (
        <Item
          text="From External Wallet"
          onPress={() => {
            setSource('external');
            setModal(CARD_DEPOSIT_MODAL.OPEN_EXTERNAL_FORM);
          }}
        />
      )}
    </View>
  );
}
