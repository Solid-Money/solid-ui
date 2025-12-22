import { Image } from 'expo-image';
import LottieView from 'lottie-react-native';
import { useEffect, useRef } from 'react';
import { Dimensions, View } from 'react-native';

import { Text } from '@/components/ui/text';
import { getBackgroundImage, OnboardingPageData } from '@/lib/types/onboarding';

interface OnboardingPageProps {
  data: OnboardingPageData;
  isActive: boolean;
  index: number;
}

const { width: screenWidth } = Dimensions.get('window');

export function OnboardingPage({ data, isActive, index }: OnboardingPageProps) {
  const animationRef = useRef<LottieView>(null);

  useEffect(() => {
    if (isActive && animationRef.current && data.animation) {
      animationRef.current.play();
    }
  }, [isActive, data.animation]);

  const backgroundImage = getBackgroundImage(index);

  return (
    <View className="flex-1 items-center justify-center px-8" style={{ width: screenWidth }}>
      {/* Illustration with background - Fixed height */}
      <View className="items-center justify-center relative" style={{ height: 350 }}>
        {/* Background Image - show for all slides */}
        {backgroundImage && (
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

        {/* Animation/Image */}
        <View style={{ zIndex: 1 }}>
          {data.image ? (
            <Image
              source={data.image}
              alt={data.title}
              style={{ width: 334, height: 334 }}
              contentFit="contain"
            />
          ) : data.animation ? (
            <View
              style={{
                transform: [{ scale: 1.3 }],
                ...(index === 2 && { marginRight: 20 }),
              }}
            >
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
            </View>
          ) : null}
        </View>
      </View>

      {/* Title and Subtitle - Fixed height */}
      <View className="items-center justify-center max-w-sm" style={{ height: 100, marginTop: 24 }}>
        {data.title && (
          <>
            <Text className="text-3xl font-semibold text-center">{data.title}</Text>
            {data.subtitle && (
              <Text className="text-white/70 text-lg text-center mt-2">{data.subtitle}</Text>
            )}
          </>
        )}
      </View>
    </View>
  );
}
