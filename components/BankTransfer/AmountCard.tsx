import { Text } from '@/components/ui/text';
import { ReactNode } from 'react';
import { View } from 'react-native';
import AmountInput from './AmountInput';

type AmountCardProps = {
  title: string;
  amount: string;
  onChangeAmount: (value: string) => void;
  rightComponent: ReactNode;
  isModal?: boolean;
};

export default function AmountCard({
  title,
  amount,
  onChangeAmount,
  rightComponent,
  isModal = false,
}: AmountCardProps) {
  return (
    <View className="bg-[#1C1C1C] rounded-2xl px-6 py-8 gap-4">
      <Text className="text-muted-foreground text-lg font-medium">{title}</Text>
      <View className="flex-row items-center gap-3">
        <AmountInput value={amount} onChangeText={onChangeAmount} isModal={isModal} />
        {rightComponent}
      </View>
    </View>
  );
}
