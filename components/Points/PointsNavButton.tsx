import { Text, View } from 'react-native';
import { Image } from 'expo-image';

import { useUserRewards } from '@/hooks/useRewards';
import { getAsset } from '@/lib/assets';

const PointsNavButton = () => {
  const { data: points } = useUserRewards();
  return (
    <View className="flex-row items-center justify-center gap-1 rounded-full border-2 border-white px-2 py-1">
      <Image source={getAsset('images/points-star.png')} className="h-4 w-4" />
      <Text className="text-sm text-white">{points?.userRewardsSummary?.totalPoints || 0} PT</Text>
    </View>
  );
};

export default PointsNavButton;
