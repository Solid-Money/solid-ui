import BankTransferAmount from '@/components/BankTransfer';
import { View } from 'react-native';

export default function BankTransfer() {
  return (
    <View className="flex-1 bg-background p-6">
      <View className="w-full gap-4 web:mx-auto web:max-w-3xl">
        <BankTransferAmount />
      </View>
    </View>
  );
}
