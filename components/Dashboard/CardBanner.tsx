import { Pressable, View } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';

import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { path } from '@/constants/path';
import { router } from 'expo-router';
import { useDimension } from '@/hooks/useDimension';

const CardBanner = () => {
  const { isScreenMedium } = useDimension();

  return (
    <Pressable
      onPress={() => router.push(path.CARD_WAITLIST)}
      className="flex-1 overflow-hidden rounded-twice"
    >
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
          <View className="max-w-40 md:max-w-64 justify-between items-start gap-4 py-5 md:py-8">
            <Text className="text-xl md:text-3xl font-semibold">Introducing the Solid Card</Text>
            <Button
              className="rounded-xl h-12 px-6 border-0 bg-button-earning web:hover:bg-button-earning web:hover:brightness-110"
              onPress={() => router.push(path.CARD_WAITLIST)}
            >
              <Text className="text-base text-primary font-bold">Reserve your card</Text>
            </Button>
          </View>
          <View className="-mt-14 -ml-4 md:-mt-4">
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
    </Pressable>
  );
};

export default CardBanner;
