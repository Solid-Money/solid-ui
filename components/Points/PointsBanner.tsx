import { Pressable, View } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Link, router } from 'expo-router';
import { ChevronRight, Plus } from 'lucide-react-native';

import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { path } from '@/constants/path';
import { useDimension } from '@/hooks/useDimension';

const PointsBanner = () => {
  const { isScreenMedium } = useDimension();

  return (
    <Pressable
      onPress={() => router.push(path.POINTS)}
      className="flex-1 overflow-hidden rounded-twice"
    >
      <LinearGradient
        colors={['rgba(255, 209, 81, 0.25)', 'rgba(255, 209, 81, 0.17)']}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={{
          borderRadius: 20,
          height: '100%',
          width: '100%',
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        <View className="flex-1 flex-row justify-between pl-5 md:px-10">
          <View className="justify-between items-start gap-2 md:gap-4 py-5 md:py-7">
            <View className="inline max-w-40 md:max-w-64">
              <Text className="text-xl md:text-3xl font-semibold">Earn</Text>{' '}
              <Text className="text-xl md:text-3xl font-semibold text-rewards">5X</Text>{' '}
              <Text className="text-xl md:text-3xl font-semibold">points on your deposits</Text>
            </View>
            <Text className="text-muted-foreground font-semibold">
              Boosted reward until 30 November
            </Text>
            <View className="flex-row items-center gap-4">
              <Button
                variant="rewards"
                className="rounded-xl h-12 pr-6"
                onPress={() => router.push(path.POINTS)}
              >
                <Plus color="white" />
                <Text className="text-base text-primary font-bold">Earn points</Text>
              </Button>
              <Link href={path.POINTS} className="web:hover:opacity-70">
                <View className="flex-row items-center gap-0.5">
                  <Text className="font-bold">Points page</Text>
                  <ChevronRight color="white" size={18} className="mt-0.5" />
                </View>
              </Link>
            </View>
          </View>
          <View className="absolute top-[30%] left-[85%] md:top-[50%] md:left-[80%] -translate-x-1/2 -translate-y-1/2 pointer-events-none">
            <Image
              source={require('@/assets/images/points_large.png')}
              contentFit="contain"
              style={{ width: isScreenMedium ? 500 : 250, height: isScreenMedium ? 500 : 280 }}
            />
          </View>
        </View>
      </LinearGradient>
    </Pressable>
  );
};

export default PointsBanner;
