import { usePoints } from '@/hooks/usePoints';
import { Image } from 'expo-image';
import { Text, View } from 'react-native';

const PointsNavButton = () => {
  const { points } = usePoints();
  return (
    <View className="flex-row items-center justify-center gap-1 rounded-full border-2 border-white px-2 py-1">
      <Image source={require('@/assets/images/points-star.png')} className="h-4 w-4" />
      <Text className="text-sm text-white">{points.userRewardsSummary.totalPoints || 0} PT</Text>
    </View>
  );
};

export default PointsNavButton;
