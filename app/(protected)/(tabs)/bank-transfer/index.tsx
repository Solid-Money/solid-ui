import BankTransferAmount from '@/components/BankTransfer';
import { Platform, View, ViewStyle } from 'react-native';

export default function BankTransfer() {
  const containerStyle: ViewStyle | undefined =
    Platform.OS === 'web'
      ? { maxWidth: 720, alignSelf: 'center' as const, width: '100%' }
      : undefined;

  return (
    <View className="flex-1 bg-background p-6">
      <View style={containerStyle} className="gap-4">
        <BankTransferAmount />
      </View>
    </View>
  );
}
