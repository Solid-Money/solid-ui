import { View } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';

import SwipeableBanner from '@/components/Dashboard/SwipeableBanner';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { path } from '@/constants/path';
import { useDimension } from '@/hooks/useDimension';
import { getAsset } from '@/lib/assets';

const ReferBanner = () => {
  const { isScreenMedium } = useDimension();

  return (
    <SwipeableBanner onPress={() => router.push(path.REFERRAL)}>
      <LinearGradient
        colors={['rgba(126, 126, 126, 0.3)', 'rgba(126, 126, 126, 0.2)']}
        style={{
          borderRadius: 20,
          height: '100%',
          width: '100%',
          overflow: 'hidden',
        }}
      >
        <View className="flex-1 flex-row items-center justify-between pl-5 md:px-10">
          <View className="max-w-64 items-start justify-between gap-2 py-5 md:gap-4 md:py-7">
            <Text className="text-xl font-semibold md:text-3xl">Refer & Earn</Text>
            <Text className="font-semibold text-muted-foreground">
              Invite your friends and get 1% cashback on their purchases
            </Text>
            <Button
              variant="secondary"
              className="h-12 rounded-xl border-0 px-6"
              onPress={() => router.push(path.REFERRAL)}
            >
              <Text className="text-base font-bold text-primary">Refer friends</Text>
            </Button>
          </View>
          <View className="pointer-events-none -ml-6 md:ml-0">
            <Image
              source={getAsset('images/one-percent-cashback.png')}
              contentFit="contain"
              style={{ width: isScreenMedium ? 205 : 110, height: isScreenMedium ? 170 : 110 }}
            />
          </View>
        </View>
      </LinearGradient>
    </SwipeableBanner>
  );
};

export default ReferBanner;
