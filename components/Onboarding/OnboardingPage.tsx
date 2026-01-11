import { Image } from 'expo-image';
import LottieView from 'lottie-react-native';
import { Platform, useWindowDimensions, View } from 'react-native';
import Animated, { interpolate, SharedValue, useAnimatedStyle } from 'react-native-reanimated';

import { Text } from '@/components/ui/text';
import { getBackgroundImage, OnboardingPageData } from '@/lib/types/onboarding';

interface OnboardingPageProps {
  data: OnboardingPageData;
  index: number;
  scrollX: SharedValue<number>;
}

// Small screen breakpoint (iPhone SE height)
const SMALL_SCREEN_HEIGHT = 700;

export function OnboardingPage({ data, index, scrollX }: OnboardingPageProps) {
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const backgroundImage = getBackgroundImage(index);

  // Responsive sizing based on screen height
  const isSmallScreen = screenHeight < SMALL_SCREEN_HEIGHT;
  const illustrationSize = isSmallScreen ? 260 : 350;
  const lottieSize = isSmallScreen ? 220 : 280;
  const lottieScale = isSmallScreen ? 1.15 : 1.5;
  const titleSize = isSmallScreen ? 24 : 26;
  const subtitleSize = isSmallScreen ? 16 : 20;
  const textMarginTop = isSmallScreen ? 12 : 24;

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
    <View
      className="relative flex-1 items-center justify-between px-8"
      style={{ width: screenWidth }}
    >
      {/* Background Image - show for all slides */}
      {backgroundImage && (
        <Image
          source={backgroundImage}
          alt="Background"
          style={{
            position: 'absolute',
            width: illustrationSize,
            height: illustrationSize,
            top: '45%',
            left: '50%',
            right: 0,
            bottom: 0,
            transform: [{ translateY: '-50%' }, { translateX: '-50%' }],
            zIndex: 0,
          }}
          contentFit="contain"
        />
      )}

      <View className="h-10" />

      <Animated.View
        className="relative items-center justify-center"
        style={[illustrationAnimatedStyle]}
      >
        <View
          style={{
            // Only apply scale transform on web - native gets pre-computed size
            ...(Platform.OS === 'web' && { transform: [{ scale: lottieScale }] }),
            ...(index === 2 && { marginRight: isSmallScreen ? 15 : 20 }),
          }}
        >
          {data.image ? (
            <Image
              source={data.image.source}
              style={{ width: data.image.width, height: data.image.height }}
              contentFit="contain"
            />
          ) : (
            <LottieView
              source={data.animation}
              autoPlay
              loop
              style={{ width: lottieSize, height: lottieSize }}
              resizeMode="contain"
            />
          )}
        </View>
      </Animated.View>

      {/* Title and Subtitle - Flexible height with slide animation */}
      <Animated.View
        className="max-w-sm items-center justify-center"
        style={[{ marginTop: textMarginTop }, textAnimatedStyle]}
      >
        {data.title && (
          <>
            <Text style={{ fontSize: titleSize }} className="text-center font-semibold">
              {data.title}
            </Text>
            {data.subtitle && (
              <Text style={{ fontSize: subtitleSize }} className="mt-2 text-center text-white/70">
                {data.subtitle}
              </Text>
            )}
          </>
        )}
      </Animated.View>
    </View>
  );
}
