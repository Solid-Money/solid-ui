import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { ChevronDown, Leaf, Wallet as WalletIcon } from 'lucide-react-native';

import { Text } from '@/components/ui/text';
import { CardDepositSource } from '@/store/useCardDepositStore';

export type ToDestinationProps = {
  value: CardDepositSource;
  onChange: (value: CardDepositSource) => void;
};

export default function ToDestinationSelector({ value, onChange }: ToDestinationProps) {
  const [isOpen, setIsOpen] = useState(false);
  const displayText = value === CardDepositSource.WALLET ? 'Wallet' : 'Savings';
  const tokenLabel = value === CardDepositSource.WALLET ? 'USDC' : 'soUSD';

  return (
    <View>
      <Pressable
        className="flex-row items-center justify-between rounded-2xl bg-accent p-4"
        onPress={() => setIsOpen(!isOpen)}
      >
        <View className="flex-row items-center gap-2">
          {value === CardDepositSource.WALLET ? (
            <WalletIcon color="#A1A1A1" size={24} />
          ) : (
            <Leaf color="#A1A1A1" size={24} />
          )}
          <Text className="text-lg font-semibold">{displayText}</Text>
        </View>
        <View className="flex-row items-center gap-2">
          <Text className="text-sm text-muted-foreground">{tokenLabel}</Text>
          <ChevronDown color="#A1A1A1" size={20} />
        </View>
      </Pressable>
      {isOpen && (
        <View className="mt-1 overflow-hidden rounded-2xl bg-accent">
          <Pressable
            className="flex-row items-center gap-2 px-4 py-3"
            onPress={() => {
              onChange(CardDepositSource.SAVINGS);
              setIsOpen(false);
            }}
          >
            <Leaf color="#A1A1A1" size={20} />
            <Text className="text-lg">Savings</Text>
            <Text className="text-sm text-muted-foreground">soUSD</Text>
          </Pressable>
          <Pressable
            className="flex-row items-center gap-2 px-4 py-3"
            onPress={() => {
              onChange(CardDepositSource.WALLET);
              setIsOpen(false);
            }}
          >
            <WalletIcon color="#A1A1A1" size={20} />
            <Text className="text-lg">Wallet</Text>
            <Text className="text-sm text-muted-foreground">USDC</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}
