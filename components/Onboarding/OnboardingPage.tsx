import { Image } from 'expo-image';
import LottieView from 'lottie-react-native';
import { useEffect, useRef } from 'react';
import { Dimensions, View } from 'react-native';

import { Text } from '@/components/ui/text';
import { OnboardingPageData } from '@/lib/types/onboarding';

const getBackgroundImage = (index: number) => {
  switch (index) {
    case 0:
      return require('@/assets/images/purple_onboarding_bg.png');
    case 1:
      return require('@/assets/images/yellow_onboarding_bg.png');
    case 2:
      return require('@/assets/images/green_onboarding_bg.png');
    default:
      return null;
  }
};

interface OnboardingPageProps {
  data: OnboardingPageData;
  isActive: boolean;
  index: number;
}

const { width: screenWidth } = Dimensions.get('window');

export function OnboardingPage({ data, isActive, index }: OnboardingPageProps) {
  const animationRef = useRef<LottieView>(null);

  useEffect(() => {
    if (isActive && animationRef.current && !data.isLastPage) {
      animationRef.current.play();
    }
  }, [isActive, data.isLastPage]);

  const backgroundImage = getBackgroundImage(index);

  return (
    <View className="flex-1 items-center justify-center px-8" style={{ width: screenWidth }}>
      <View className="items-center justify-center py-10 relative">
        {/* Background Image */}
        {backgroundImage && !data.isLastPage && (
          <Image
            source={backgroundImage}
            alt="Background"
            style={{
              position: 'absolute',
              width: 350,
              height: 350,
              zIndex: 0,
            }}
            contentFit="contain"
          />
        )}

        {/* Animation/Logo */}
        <View style={{ zIndex: 1 }}>
          {data.isLastPage ? (
            <Image
              source={data.image}
              alt="Solid logo"
              style={{ width: 334, height: 334 }}
              contentFit="contain"
            />
          ) : (
            <LottieView
              ref={animationRef}
              source={data.animation}
              autoPlay={false}
              loop
              style={{
                width: 280,
                height: 280,
              }}
              resizeMode="contain"
            />
          )}
        </View>
      </View>

      {data.title && (
        <View className="items-center max-w-sm">
          <Text className="text-3xl font-semibold text-center">{data.title}</Text>
        </View>
      )}
    </View>
  );
}
