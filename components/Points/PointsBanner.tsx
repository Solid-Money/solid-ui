import { Button, buttonVariants } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { path } from '@/constants/path';
import { usePoints } from '@/hooks/usePoints';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Platform, View } from 'react-native';

const PointsTitle = () => {
  const { points } = usePoints();
  return (
    <LinearGradient
      start={{ x: 0.5, y: 0 }}
      end={{ x: 0.5, y: 1 }}
      colors={['rgba(255, 209, 81, 0.25)', 'rgba(255, 209, 81, 0.17)']}
      className={'rounded-twice flex-row justify-start w-full h-20 hidden md:flex'}
      style={Platform.OS === 'web' ? {} : { borderRadius: 20 }}
    >
      <View className="w-1/12">
        <Image
          source={require('@/assets/images/points_large.png')}
          style={{ width: 140, height: 140, marginTop: -30 }}
        />
      </View>
      <View className="p-4 flex-row justify-between items-center w-11/12">
        <View className="flex-row items-end">
          <View className="flex-row items-end">
            <Text className="text-2xl/none font-semibold">
              <Text className="text-2xl/none font-semibold text-rewards mr-1">
                {points.userRewardsSummary.totalPoints || 0}
              </Text>
              points earned
            </Text>
            <Text className="text-lg/none text-rewards/70 ml-4">
              Earning 10 points per $1 per day
            </Text>
          </View>
        </View>

        <View>
          <Button
            variant="rewards"
            className={buttonVariants({
              variant: 'rewards',
              className: 'rounded-xl h-full',
            })}
            onPress={() => {
              router.push(path.POINTS);
            }}
          >
            <View className="flex-row items-center px-5 py-1">
              <Text className="font-bold">View points</Text>
            </View>
          </Button>
        </View>
      </View>
    </LinearGradient>
  );
};

export default PointsTitle;
