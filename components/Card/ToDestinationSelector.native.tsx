import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { ChevronDown, Wallet as WalletIcon } from 'lucide-react-native';

import { Text } from '@/components/ui/text';
import { CardDepositSource } from '@/store/useCardDepositStore';

export type ToDestinationProps = {
  value: CardDepositSource;
  onChange: (value: CardDepositSource) => void;
  tokenSymbol?: string;
};

export default function ToDestinationSelector({
  value,
  onChange,
  tokenSymbol = 'USDC',
}: ToDestinationProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <View>
      <Pressable
        className="flex-row items-center justify-between rounded-2xl bg-accent p-4"
        onPress={() => setIsOpen(!isOpen)}
      >
        <View className="flex-row items-center gap-2">
          <WalletIcon color="#A1A1A1" size={24} />
          <Text className="text-lg font-semibold">Wallet</Text>
        </View>
        <View className="flex-row items-center gap-2">
          <Text className="text-sm text-muted-foreground">{tokenSymbol}</Text>
          <ChevronDown color="#A1A1A1" size={20} />
        </View>
      </Pressable>
      {isOpen && (
        <View className="mt-1 overflow-hidden rounded-2xl bg-accent">
          <Pressable
            className="flex-row items-center gap-2 px-4 py-3"
            onPress={() => {
              onChange(CardDepositSource.COLLATERAL);
              setIsOpen(false);
            }}
          >
            <WalletIcon color="#A1A1A1" size={20} />
            <Text className="text-lg">Wallet</Text>
            <Text className="text-sm text-muted-foreground">{tokenSymbol}</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}
