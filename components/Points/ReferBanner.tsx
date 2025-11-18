import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { View } from 'react-native';
import { router } from 'expo-router';

import SwipeableBanner from '@/components/Dashboard/SwipeableBanner';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { path } from '@/constants/path';
import { useDimension } from '@/hooks/useDimension';

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
        <View className="flex-1 flex-row justify-between items-center pl-5 md:px-10">
          <View className="max-w-64 justify-between items-start gap-2 md:gap-4 py-5 md:py-7">
            <Text className="text-xl md:text-3xl font-semibold">Refer & Earn</Text>
            <Text className="text-muted-foreground font-semibold">
              Invite your friends and get 1% cashback on their purchases
            </Text>
            <Button
              variant="secondary"
              className="rounded-xl h-12 px-6 border-0"
              onPress={() => router.push(path.REFERRAL)}
            >
              <Text className="text-base text-primary font-bold">Refer friends</Text>
            </Button>
          </View>
          <View className="-ml-6 md:ml-0 pointer-events-none">
            <Image
              source={require('@/assets/images/one-percent-cashback.png')}
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
