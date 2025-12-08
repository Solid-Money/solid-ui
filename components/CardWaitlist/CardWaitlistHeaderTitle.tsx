import { View } from 'react-native';

import { Text } from '@/components/ui/text';
import { useDimension } from '@/hooks/useDimension';

const CardWaitlistHeaderTitle = () => {
  const { isScreenMedium } = useDimension();

  return (
    <View className="gap-3">
      <Text className="text-xl md:text-3xl font-bold md:font-semibold">Card</Text>

      {isScreenMedium ? (
        <View className="gap-1">
          <Text className="opacity-70 leading-5 text-[1rem]">
            Spend with Visa and earn 3% cashback on every purchase.
          </Text>
          <Text className="opacity-70 leading-5 text-[1rem]">
            Non-custodial, secure by design, and ready to use with Apple or Google Pay.
          </Text>
        </View>
      ) : (
        <View className="max-w-xs">
          <Text className="text-sm font-medium opacity-70 leading-5 text-[1rem]">
            Spend with Visa and earn 3% cashback on every purchase. Non-custodial, secure by design,
            and ready to use with Apple or Google Pay.
          </Text>
        </View>
      )}
    </View>
  );
};

export default CardWaitlistHeaderTitle;
