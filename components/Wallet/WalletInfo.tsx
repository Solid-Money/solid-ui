import { View } from 'react-native';

import { Text } from '@/components/ui/text';

interface WalletInfoProps {
  text: string;
}

const WalletInfo = ({ text }: WalletInfoProps) => {
  return (
    <View className="flex-1 items-center justify-center p-8">
      <Text className="text-lg">{text}</Text>
    </View>
  );
};

export default WalletInfo;
