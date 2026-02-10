import { View } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Link, router } from 'expo-router';
import { ChevronRight, Plus } from 'lucide-react-native';

import SwipeableBanner from '@/components/Dashboard/SwipeableBanner';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { path } from '@/constants/path';
import { useDimension } from '@/hooks/useDimension';
import { useHoldingFundsPointsMultiplier } from '@/hooks/useHoldingFundsPointsMultiplier';
import { getAsset } from '@/lib/assets';

const PointsBanner = () => {
  const { isScreenMedium } = useDimension();
  const { multiplier } = useHoldingFundsPointsMultiplier();

  return (
    <SwipeableBanner onPress={() => router.push(path.POINTS)}>
      <View
        style={{
          borderRadius: 20,
          flex: 1,
          width: '100%',
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        <LinearGradient
          colors={['rgba(255, 209, 81, 1)', 'rgba(255, 209, 81, 0.4)']}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.6, y: 1 }}
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: 0,
            bottom: 0,
            opacity: 0.15,
          }}
        />
        <View className="flex-1 flex-row justify-between pl-5 md:px-10">
          <View className="flex-1 items-start justify-between py-5 md:gap-2 md:py-8">
            <View className="inline max-w-40 md:max-w-64">
              <Text className="native:text-lg text-xl font-semibold md:text-3xl">
                Earn <Text className="text-rewards">{multiplier}X</Text> points on your deposits
              </Text>
            </View>
            <View className="flex-row items-center gap-4">
              <Button
                variant="rewards"
                className="h-11 rounded-xl pr-6 md:h-12"
                onPress={() => router.push(path.POINTS)}
              >
                <Plus color="white" />
                <Text className="text-base font-bold text-primary">Earn points</Text>
              </Button>
              <Link href={path.POINTS} className="web:hover:opacity-70">
                <View className="flex-row items-center gap-0.5">
                  <Text className="text-base font-bold">Points page</Text>
                  <ChevronRight color="white" size={18} className="mt-0.5" />
                </View>
              </Link>
            </View>
          </View>
          <View className="pointer-events-none absolute left-[85%] top-[30%] -translate-x-1/2 -translate-y-1/2 md:left-[80%] md:top-[50%]">
            <Image
              source={getAsset('images/points_large.png')}
              contentFit="contain"
              style={{ width: isScreenMedium ? 500 : 250, height: isScreenMedium ? 500 : 280 }}
            />
          </View>
        </View>
      </View>
    </SwipeableBanner>
  );
};

export default PointsBanner;
