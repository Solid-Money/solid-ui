import { Link } from 'expo-router';
import { View } from 'react-native';

import { Text } from '@/components/ui/text';

const CardWaitlistHeaderTitle = () => {
  return (
    <View className="gap-3">
      <Text className="text-3xl font-semibold">Spend</Text>
      <Text className="max-w-lg">
        <Text className="opacity-70">
          Join the waitlist to be one of the first to get your Solid VISA Card powered by Bridge.
        </Text>{' '}
        <Link
          href="https://docs.solid.xyz/how-solid-works/solid-card-coming-soon"
          target="_blank"
          className="text-primary font-medium underline hover:opacity-70"
        >
          How it works
        </Link>
      </Text>
    </View>
  );
};

export default CardWaitlistHeaderTitle;
