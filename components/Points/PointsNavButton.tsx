import { usePoints } from '@/hooks/usePoints';
import { Image } from 'expo-image';
import { Text, View } from 'react-native';

const PointsNavButton = () => {
  const { points } = usePoints();
  return (
    <View className="flex-row items-center justify-center border-2 border-white rounded-full py-1 px-2 gap-1">
      <Image source={require('@/assets/images/points-star.png')} className="w-4 h-4" />
      <Text className="text-white text-sm">{points.userRewardsSummary.totalPoints || 0} PT</Text>
    </View>
  );
};

export default PointsNavButton;
