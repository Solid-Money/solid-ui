import { Link } from 'expo-router';
import { View } from 'react-native';

import { Text } from '@/components/ui/text';

const CardWaitlistHeaderTitle = () => {
  return (
    <View className="gap-3">
      <Text className="text-3xl font-semibold">Spend</Text>

      <View className="gap-1">
        <Text className="opacity-70 leading-5">
          Spend with Visa and earn 2% cashback on every purchase.
        </Text>
        <Text className="opacity-70 leading-5">
          Non-custodial, secure by design, and ready to use with Apple or Google Pay.
        </Text>
        <Link
          href="https://docs.solid.xyz/how-solid-works/solid-card-coming-soon"
          target="_blank"
          className="text-base text-primary font-medium underline hover:opacity-70"
        >
          How it works
        </Link>
      </View>
    </View>
  );
};

export default CardWaitlistHeaderTitle;
