import { View } from 'react-native';

import { Text } from '@/components/ui/text';
import { useDimension } from '@/hooks/useDimension';

const CardWaitlistHeaderTitle = () => {
  const { isScreenMedium } = useDimension();

  return (
    <View className="gap-3">
      <Text className="text-3xl font-semibold">Card</Text>

      {isScreenMedium ? (
        <View className="gap-1">
          <Text className="text-[1rem] leading-5 opacity-70">
            Spend with Visa and earn 3% cashback on every purchase.
          </Text>
          <Text className="text-[1rem] leading-5 opacity-70">
            Non-custodial, secure by design, and ready to use with Apple or Google Pay.
          </Text>
        </View>
      ) : (
        <View className="max-w-xs">
          <Text className="text-[1rem] text-sm font-medium leading-5 opacity-70">
            Spend with Visa and earn 3% cashback on every purchase. Non-custodial, secure by design,
            and ready to use with Apple or Google Pay.
          </Text>
        </View>
      )}
    </View>
  );
};

export default CardWaitlistHeaderTitle;
