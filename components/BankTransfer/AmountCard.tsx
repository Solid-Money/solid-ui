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
    <View className="gap-4 rounded-2xl bg-[#1C1C1C] px-6 py-8">
      <Text className="text-lg font-medium text-[#ACACAC]">{title}</Text>
      <View className="flex-row items-center gap-3">
        <AmountInput value={amount} onChangeText={onChangeAmount} isModal={isModal} />
        {rightComponent}
      </View>
    </View>
  );
}
