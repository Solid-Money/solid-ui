import { Image } from 'expo-image';
import { View } from 'react-native';

import { Text } from '@/components/ui/text';

const CardBenefits = () => {
  return (
    <View className="flex-row justify-between items-center gap-x-4 gap-y-5">
      <View className="items-center md:items-start gap-3">
        <Image
          source={require('@/assets/images/card_benefits_one.png')}
          contentFit="contain"
          style={{ width: 64, height: 64 }}
        />
        <Text className="leading-4 md:text-2xl max-w-24 md:max-w-36 text-center md:text-start">
          Spend your yield
        </Text>
      </View>
      <View className="items-center md:items-start gap-3">
        <Image
          source={require('@/assets/images/card_benefits_two.png')}
          contentFit="contain"
          style={{ width: 64, height: 64 }}
        />
        <Text className="leading-4 md:text-2xl max-w-24 md:max-w-32 text-center md:text-start">
          Accepted anywhere
        </Text>
      </View>
      <View className="items-center md:items-start gap-3">
        <Image
          source={require('@/assets/images/card_benefits_three.png')}
          contentFit="contain"
          style={{ width: 64, height: 64 }}
        />
        <Text className="leading-4 md:text-2xl max-w-24 md:max-w-32 text-center md:text-start">
          3% Cashback
        </Text>
      </View>
    </View>
  );
};

export default CardBenefits;
