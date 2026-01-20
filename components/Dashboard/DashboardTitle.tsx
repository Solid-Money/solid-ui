import { View } from 'react-native';
import { Link } from 'expo-router';

import { Text } from '@/components/ui/text';

const DashboardTitle = () => {
  return (
    <View className="gap-3">
      <Text className="native:text-2xl font-semibold web:text-3xl">Savings</Text>
      <Text className="max-w-lg">
        <Text className="text-[1rem] opacity-70">
          Our Solid vault will automatically manage your funds to maximize your yield without
          exposing you to unnecessary risk.
        </Text>{' '}
        <Link
          href="https://support.solid.xyz/en/articles/12156695-what-is-solid"
          target="_blank"
          className="text-[1rem] font-medium text-primary hover:opacity-70 web:underline"
        >
          How it works
        </Link>
      </Text>
    </View>
  );
};

export default DashboardTitle;
