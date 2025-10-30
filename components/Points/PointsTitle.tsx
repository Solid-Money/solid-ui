import { View } from 'react-native';

import { Text } from '@/components/ui/text';

const PointsTitle = () => {
  return (
    <View className="gap-3">
      <Text className="text-3xl font-semibold">Points</Text>
      <Text className="max-w-lg">
        <Text className="opacity-70">
          Turn your deposits and referrals into points that unlock future rewards.
        </Text>
      </Text>
    </View>
  );
};

export default PointsTitle;
