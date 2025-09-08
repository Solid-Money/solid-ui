import { Image } from 'expo-image';
import { View } from 'react-native';

import { Text } from '@/components/ui/text';

const CardBenefits = () => {
  return (
    <View className="flex-row justify-between items-center gap-x-4 gap-y-5">
      <View className="items-center md:items-start gap-4">
        <Image
          source={require('@/assets/images/deposit-green.png')}
          contentFit="contain"
          style={{ width: 64, height: 64 }}
        />
        <Text className="leading-4 md:text-2xl max-w-24 md:max-w-36 text-center md:text-start">
          Deposit as little as $1
        </Text>
      </View>
      <View className="items-center md:items-start gap-4">
        <Image
          source={require('@/assets/images/withdraw-green.png')}
          contentFit="contain"
          style={{ width: 64, height: 64 }}
        />
        <Text className="leading-4 md:text-2xl max-w-24 md:max-w-32 text-center md:text-start">
          Withdraw anytime
        </Text>
      </View>
      <View className="items-center md:items-start gap-4">
        <Image
          source={require('@/assets/images/earn-green.png')}
          contentFit="contain"
          style={{ width: 64, height: 64 }}
        />
        <Text className="leading-4 md:text-2xl max-w-24 md:max-w-32 text-center md:text-start">
          Earn every second
        </Text>
      </View>
    </View>
  );
};

export default CardBenefits;
