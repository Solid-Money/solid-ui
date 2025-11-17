import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Link, router } from 'expo-router';
import { View } from 'react-native';

import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { path } from '@/constants/path';
import { useDimension } from '@/hooks/useDimension';
import SwipeableBanner from './SwipeableBanner';

const CardBanner = () => {
  const { isScreenMedium } = useDimension();

  return (
    <SwipeableBanner onPress={() => router.push(path.CARD_WAITLIST)}>
      <LinearGradient
        colors={['rgba(148, 242, 127, 0.25)', 'rgba(148, 242, 127, 0)']}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.6, y: 1 }}
        style={{
          borderRadius: 20,
          height: '100%',
          width: '100%',
          overflow: 'hidden',
        }}
      >
        <View className="flex-1 flex-row justify-between pl-5 md:px-10">
          <View className="max-w-40 md:max-w-64 justify-between items-start gap-1 md:gap-4 py-4 md:py-8">
            <Text className="text-xl md:text-3xl font-semibold">Solid Card is live!</Text>
            <View className="inline">
              <Text className="text-muted-foreground font-semibold">
                Get your card today and receive $50 bonus.
              </Text>{' '}
              <Text className="text-muted-foreground font-semibold hover:opacity-70">
                <Link
                  target="_blank"
                  href={
                    'https://docs.solid.xyz/how-solid-works/solid-card/solid-card-launch-campaign-terms-and-conditions'
                  }
                  className="underline"
                >
                  Read more
                </Link>{' '}
                {'>'}
              </Text>
            </View>
            <Button
              className="rounded-xl h-11 md:h-12 px-6 border-0 bg-button-earning web:hover:bg-button-earning web:hover:brightness-110"
              onPress={() => router.push(path.CARD_WAITLIST)}
            >
              <Text className="text-base text-primary font-bold">Get your card</Text>
            </Button>
          </View>
          <View className="-mt-14 -ml-4 md:-mt-4 pointer-events-none">
            <Image
              source={
                isScreenMedium
                  ? require('@/assets/images/cards-banner.png')
                  : require('@/assets/images/cards-mobile.png')
              }
              contentFit="contain"
              style={{ width: isScreenMedium ? 250 : 250, height: isScreenMedium ? 250 : 280 }}
            />
          </View>
        </View>
      </LinearGradient>
    </SwipeableBanner>
  );
};

export default CardBanner;
