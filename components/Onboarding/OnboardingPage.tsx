import { Image } from 'expo-image';
import LottieView from 'lottie-react-native';
import { useWindowDimensions, View } from 'react-native';
import Animated, { interpolate, SharedValue, useAnimatedStyle } from 'react-native-reanimated';

import { Text } from '@/components/ui/text';
import { getBackgroundImage, OnboardingPageData } from '@/lib/types/onboarding';

interface OnboardingPageProps {
  data: OnboardingPageData;
  index: number;
  scrollX: SharedValue<number>;
}

export function OnboardingPage({ data, index, scrollX }: OnboardingPageProps) {
  const { width: screenWidth } = useWindowDimensions();
  const backgroundImage = getBackgroundImage(index);

  // Calculate the input range for this specific page
  const inputRange = [(index - 1) * screenWidth, index * screenWidth, (index + 1) * screenWidth];

  // Animated style for the illustration - slides in from right, exits to left
  const illustrationAnimatedStyle = useAnimatedStyle(() => {
    const translateX = interpolate(scrollX.value, inputRange, [100, 0, -100], 'clamp');
    const opacity = interpolate(scrollX.value, inputRange, [0, 1, 0], 'clamp');
    const scale = interpolate(scrollX.value, inputRange, [0.8, 1, 0.8], 'clamp');
    return {
      transform: [{ translateX }, { scale }],
      opacity,
    };
  });

  // Animated style for the text - slides in with a slight delay effect
  const textAnimatedStyle = useAnimatedStyle(() => {
    const translateY = interpolate(scrollX.value, inputRange, [30, 0, -30], 'clamp');
    const opacity = interpolate(scrollX.value, inputRange, [0, 1, 0], 'clamp');
    return {
      transform: [{ translateY }],
      opacity,
    };
  });

  return (
    <View className="flex-1 items-center justify-center px-8" style={{ width: screenWidth }}>
      {/* Illustration with background - Fixed height */}
      <Animated.View
        className="items-center justify-center relative"
        style={[{ height: 350 }, illustrationAnimatedStyle]}
      >
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
          <View
            style={{
              transform: [{ scale: 1.3 }],
              ...(index === 2 && { marginRight: 20 }),
            }}
          >
            <LottieView
              source={data.animation}
              autoPlay
              loop
              style={{
                width: 280,
                height: 280,
              }}
              resizeMode="contain"
            />
          </View>
        </View>
      </Animated.View>

      {/* Title and Subtitle - Fixed height with slide animation */}
      <Animated.View
        className="items-center justify-center max-w-sm"
        style={[{ height: 100, marginTop: 24 }, textAnimatedStyle]}
      >
        {data.title && (
          <>
            <Text className="text-[28px] font-semibold text-center">{data.title}</Text>
            {data.subtitle && (
              <Text className="text-white/70 text-[20px] text-center mt-2">{data.subtitle}</Text>
            )}
          </>
        )}
      </Animated.View>
    </View>
  );
}
