import { Image } from 'expo-image';
import { View } from 'react-native';

import { Text } from '@/components/ui/text';
import { getAsset } from '@/lib/assets';

const SavingDepositBenefits = () => {
  return (
    <View className="flex-row items-center justify-between gap-x-4 gap-y-5">
      <View className="items-center gap-4 md:items-start">
        <Image
          source={getAsset('images/deposit-purple.png')}
          contentFit="contain"
          style={{ width: 64, height: 64 }}
        />
        <Text className="max-w-24 text-center text-base leading-4 md:max-w-36 md:text-start md:text-2xl md:leading-[29px]">
          Earn from as little as $1
        </Text>
      </View>
      <View className="items-center gap-4 md:items-start">
        <Image
          source={getAsset('images/withdraw-purple.png')}
          contentFit="contain"
          style={{ width: 64, height: 64 }}
        />
        <Text className="max-w-24 text-center text-base leading-4 md:max-w-32 md:text-start md:text-2xl md:leading-[29px]">
          Withdraw anytime
        </Text>
      </View>
      <View className="items-center gap-4 md:items-start">
        <Image
          source={getAsset('images/earn-purple.png')}
          contentFit="contain"
          style={{ width: 64, height: 64 }}
        />
        <Text className="max-w-24 text-center text-base leading-4 md:max-w-32 md:text-start md:text-2xl md:leading-[29px]">
          Earn every second
        </Text>
      </View>
    </View>
  );
};

export default SavingDepositBenefits;
