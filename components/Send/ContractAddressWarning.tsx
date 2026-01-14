import { View } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';

import { Text } from '@/components/ui/text';
import { getAsset } from '@/lib/assets';

interface ContractAddressWarningProps {
  chainName: string;
}

const ContractAddressWarning = ({ chainName }: ContractAddressWarningProps) => {
  return (
    <LinearGradient
      colors={['rgba(255, 209, 81, 0.1)', 'rgba(255, 209, 81, 0.05)']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      className="rounded-2xl border border-warning/15"
    >
      <View className="flex-row gap-2 gap-3 px-5 py-4">
        <Image
          source={getAsset('images/exclamation-warning.png')}
          style={{ width: 22, height: 22 }}
          contentFit="contain"
        />
        <View className="flex-1">
          <Text className="max-w-64 text-base font-bold text-warning">
            This appears to be a smart contract address
          </Text>
          <Text className="max-w-72 text-sm font-medium leading-5 text-warning">
            Please verify that the recipient address is able to receive assets on {chainName}
          </Text>
        </View>
      </View>
    </LinearGradient>
  );
};

export default ContractAddressWarning;
