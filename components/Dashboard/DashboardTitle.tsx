import { Link } from 'expo-router';
import { View } from 'react-native';

import { Text } from '@/components/ui/text';

const DashboardTitle = () => {
  return (
    <View className="gap-3">
      <Text className="text-3xl font-semibold">Your saving account</Text>
      <Text className="max-w-lg">
        <Text className="opacity-70">
          Our Solid vault will automatically manage your funds to maximize your yield without
          exposing you to unnecessary risk.
        </Text>{' '}
        <Link
          href="https://docs.solid.xyz/what-is-solid"
          target="_blank"
          className="text-primary font-medium underline hover:opacity-70"
        >
          How it works
        </Link>
      </Text>
    </View>
  );
};

export default DashboardTitle;
