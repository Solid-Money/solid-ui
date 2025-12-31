import { Link } from 'expo-router';
import { View } from 'react-native';

import { Text } from '@/components/ui/text';

const DashboardTitle = () => {
  return (
    <View className="gap-3">
      <Text className="web:text-3xl native:text-2xl font-semibold">Savings</Text>
      <Text className="max-w-lg">
        <Text className="opacity-70 text-[1rem]">
          Our Solid vault will automatically manage your funds to maximize your yield without
          exposing you to unnecessary risk.
        </Text>{' '}
        <Link
          href="https://support.solid.xyz/en/articles/12156695-what-is-solid"
          target="_blank"
          className="text-primary font-medium underline hover:opacity-70 text-[1rem]"
        >
          How it works
        </Link>
      </Text>
    </View>
  );
};

export default DashboardTitle;
