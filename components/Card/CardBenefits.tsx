import { Image } from 'expo-image';
import { View } from 'react-native';

import { Text } from '@/components/ui/text';

const CardBenefits = () => {
  return (
    <View className="flex-row items-center justify-between gap-x-4 gap-y-5">
      <View className="items-center gap-3 md:items-start">
        <Image
          source={require('@/assets/images/card_benefits_one.png')}
          contentFit="contain"
          style={{ width: 64, height: 64 }}
        />
        <Text className="max-w-24 text-center leading-4 md:max-w-36 md:text-start md:text-2xl">
          Spend your yield
        </Text>
      </View>
      <View className="items-center gap-3 md:items-start">
        <Image
          source={require('@/assets/images/card_benefits_two.png')}
          contentFit="contain"
          style={{ width: 64, height: 64 }}
        />
        <Text className="max-w-24 text-center leading-4 md:max-w-32 md:text-start md:text-2xl">
          Accepted anywhere
        </Text>
      </View>
      <View className="items-center gap-3 md:items-start">
        <Image
          source={require('@/assets/images/card_benefits_three.png')}
          contentFit="contain"
          style={{ width: 64, height: 64 }}
        />
        <Text className="max-w-24 text-center leading-4 md:max-w-32 md:text-start md:text-2xl">
          3% Cashback
        </Text>
      </View>
    </View>
  );
};

export default CardBenefits;
