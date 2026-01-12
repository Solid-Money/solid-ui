import { ReactNode } from 'react';
import { View } from 'react-native';
import AmountInput from './AmountInput';

type AmountCardProps = {
  amount: string;
  onChangeAmount: (value: string) => void;
  rightComponent: ReactNode;
  isModal?: boolean;
};

export default function AmountCard({
  amount,
  onChangeAmount,
  rightComponent,
  isModal = false,
}: AmountCardProps) {
  return (
    <View className="flex-row items-center gap-3 rounded-2xl bg-[#1C1C1C] px-6 py-3">
      <AmountInput value={amount} onChangeText={onChangeAmount} isModal={isModal} />
      {rightComponent}
    </View>
  );
}
