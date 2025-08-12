import BankTransferAmount from '@/components/BankTransfer';
import { View } from 'react-native';

export default function BankTransfer() {
  return (
    <View className="flex-1 bg-background p-6 gap-4">
      <BankTransferAmount />
    </View>
  );
}
