import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import LottieView from 'lottie-react-native';
import { useCallback, useEffect, useRef } from 'react';
import { Pressable, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { Text } from '@/components/ui/text';
import { getBackgroundImage, getGradientColors, ONBOARDING_DATA } from '@/lib/types/onboarding';
import { useCarouselStore } from '@/store/useCarouselStore';

const SWIPE_THRESHOLD = 20;
const SLIDE_DURATION = 400;

const HELP_CENTER_URL = 'https://help.solid.xyz';

interface InteractiveDotProps {
  isActive: boolean;
  onPress: () => void;
}

function InteractiveDot({ isActive, onPress }: InteractiveDotProps) {
  const animatedStyle = useAnimatedStyle(() => {
    const width = withSpring(isActive ? 20 : 8, { damping: 15, stiffness: 200 });
    return {
      width,
      backgroundColor: isActive ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.4)',
    };
  });

  return (
    <Pressable onPress={onPress} hitSlop={8}>
      <Animated.View
        style={[
          {
            height: 8,
            borderRadius: 4,
          },
          animatedStyle,
        ]}
      />
    </Pressable>
  );
}

interface InteractivePaginationProps {
  currentIndex: number;
  totalSlides: number;
  onIndexChange: (index: number) => void;
}

function InteractivePagination({
  currentIndex,
  totalSlides,
  onIndexChange,
}: InteractivePaginationProps) {
  return (
    <View className="flex-row items-center justify-center gap-2">
      {Array.from({ length: totalSlides }).map((_, index) => (
        <InteractiveDot
          key={index}
          isActive={index === currentIndex}
          onPress={() => onIndexChange(index)}
        />
      ))}
    </View>
  );
}

interface DesktopCarouselProps {
  onHelpCenterPress?: () => void;
}

/**
 * Interactive carousel component for the desktop signup screens.
 * Displays the onboarding slides with clickable pagination dots.
 * Supports horizontal swipe/drag navigation on desktop.
 */
export function DesktopCarousel({ onHelpCenterPress }: DesktopCarouselProps) {
  const { currentIndex, setCurrentIndex } = useCarouselStore();
  const currentSlide = ONBOARDING_DATA[currentIndex];
  const backgroundImage = getBackgroundImage(currentIndex);
  const startX = useSharedValue(0);
  const prevIndexRef = useRef(currentIndex);
  const isFirstRender = useRef(true);

  // Animation values for slide transitions (start at 1 = fully visible, no animation)
  const slideProgress = useSharedValue(1);
  const slideDirection = useSharedValue(1); // 1 = forward, -1 = backward

  // Animation values for background crossfade
  const bgOpacity0 = useSharedValue(currentIndex === 0 ? 1 : 0);
  const bgOpacity1 = useSharedValue(currentIndex === 1 ? 1 : 0);
  const bgOpacity2 = useSharedValue(currentIndex === 2 ? 1 : 0);

  // Animate background and content when index changes (skip first render)
  useEffect(() => {
    // Skip animation on initial mount - content should appear instantly
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    const direction = currentIndex > prevIndexRef.current ? 1 : -1;
    slideDirection.value = direction;
    prevIndexRef.current = currentIndex;

    // Animate slide content
    slideProgress.value = 0;
    slideProgress.value = withTiming(1, {
      duration: SLIDE_DURATION,
      easing: Easing.out(Easing.cubic),
    });

    // Crossfade backgrounds
    const timing = { duration: SLIDE_DURATION, easing: Easing.inOut(Easing.ease) };
    bgOpacity0.value = withTiming(currentIndex === 0 ? 1 : 0, timing);
    bgOpacity1.value = withTiming(currentIndex === 1 ? 1 : 0, timing);
    bgOpacity2.value = withTiming(currentIndex === 2 ? 1 : 0, timing);
  }, [currentIndex, slideProgress, slideDirection, bgOpacity0, bgOpacity1, bgOpacity2]);

  // Animated styles for content slide effect
  const contentAnimatedStyle = useAnimatedStyle(() => {
    const translateX = interpolate(slideProgress.value, [0, 1], [50 * slideDirection.value, 0]);
    const opacity = interpolate(slideProgress.value, [0, 0.3, 1], [0, 0.5, 1]);

    return {
      transform: [{ translateX }],
      opacity,
    };
  });

  // Background opacity styles
  const bg0Style = useAnimatedStyle(() => ({ opacity: bgOpacity0.value }));
  const bg1Style = useAnimatedStyle(() => ({ opacity: bgOpacity1.value }));
  const bg2Style = useAnimatedStyle(() => ({ opacity: bgOpacity2.value }));

  const goToNext = useCallback(() => {
    setCurrentIndex(Math.min(currentIndex + 1, ONBOARDING_DATA.length - 1));
  }, [currentIndex, setCurrentIndex]);

  const goToPrev = useCallback(() => {
    setCurrentIndex(Math.max(currentIndex - 1, 0));
  }, [currentIndex, setCurrentIndex]);

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const handleHelpCenter = useCallback(() => {
    if (onHelpCenterPress) {
      onHelpCenterPress();
    } else {
      import('react-native').then(({ Linking }) => {
        Linking.openURL(HELP_CENTER_URL);
      });
    }
  }, [onHelpCenterPress]);

  const handleIndexChange = useCallback(
    (index: number) => {
      setCurrentIndex(index);
    },
    [setCurrentIndex],
  );

  // Pan gesture for swipe detection
  const panGesture = Gesture.Pan()
    .onStart(e => {
      startX.value = e.x;
    })
    .onEnd(e => {
      const diff = e.x - startX.value;
      if (Math.abs(diff) > SWIPE_THRESHOLD) {
        if (diff > 0) {
          runOnJS(goToPrev)();
        } else {
          runOnJS(goToNext)();
        }
      }
    });

  const gradientColors = [
    getGradientColors(0),
    getGradientColors(1),
    getGradientColors(2),
  ];

  return (
    <View className="w-[30%] min-w-[280px] max-w-[400px] rounded-2xl m-4 overflow-hidden bg-[#111]">
      {/* Stacked gradient backgrounds for crossfade effect */}
      <View style={{ position: 'absolute', width: '100%', height: '100%' }}>
        <Animated.View style={[{ position: 'absolute', width: '100%', height: '100%' }, bg0Style]}>
          <LinearGradient
            colors={gradientColors[0]}
            start={{ x: 0.2, y: 0.2 }}
            end={{ x: 0.8, y: 0.8 }}
            style={{ flex: 1 }}
          />
        </Animated.View>
        <Animated.View style={[{ position: 'absolute', width: '100%', height: '100%' }, bg1Style]}>
          <LinearGradient
            colors={gradientColors[1]}
            start={{ x: 0.2, y: 0.2 }}
            end={{ x: 0.8, y: 0.8 }}
            style={{ flex: 1 }}
          />
        </Animated.View>
        <Animated.View style={[{ position: 'absolute', width: '100%', height: '100%' }, bg2Style]}>
          <LinearGradient
            colors={gradientColors[2]}
            start={{ x: 0.2, y: 0.2 }}
            end={{ x: 0.8, y: 0.8 }}
            style={{ flex: 1 }}
          />
        </Animated.View>
      </View>

      {/* Content Container */}
      <GestureDetector gesture={panGesture}>
        <View className="flex-1 justify-center items-center px-6">
          <Animated.View style={contentAnimatedStyle} className="items-center">
            {/* Illustration with background */}
            <View className="items-center justify-center relative" style={{ height: 320 }}>
              {/* Background glow */}
              {backgroundImage && (
                <Image
                  source={backgroundImage}
                  alt="Background"
                  style={{
                    position: 'absolute',
                    width: 320,
                    height: 320,
                    zIndex: 0,
                  }}
                  contentFit="contain"
                />
              )}

              {/* Animation/Image */}
              <View style={{ zIndex: 1 }}>
                <View
                  style={{
                    transform: [{ scale: 1.6 }],
                    ...(currentIndex === 2 && { marginRight: 20 }),
                  }}
                >
                  <LottieView
                    key={`lottie-${currentIndex}`}
                    source={currentSlide.animation}
                    autoPlay
                    loop
                    style={{
                      width: 280,
                      height: 280,
                    }}
                    resizeMode="cover"
                  />
                </View>
              </View>
            </View>

            {/* Title and Subtitle */}
            <View
              className="items-center justify-center px-4"
              style={{ height: 100, marginTop: 32 }}
            >
              {currentSlide.title && (
                <>
                  <Text className="text-white text-[28px] font-semibold text-center tracking-tight">
                    {currentSlide.title}
                  </Text>
                  {currentSlide.subtitle && (
                    <Text className="text-white/70 text-[20px] text-center mt-2 leading-6">
                      {currentSlide.subtitle}
                    </Text>
                  )}
                </>
              )}
            </View>
          </Animated.View>

          {/* Pagination - outside animated content so it stays stable */}
          <View className="items-center" style={{ height: 24, marginTop: 24 }}>
            <InteractivePagination
              currentIndex={currentIndex}
              totalSlides={ONBOARDING_DATA.length}
              onIndexChange={handleIndexChange}
            />
          </View>
        </View>
      </GestureDetector>
    </View>
  );
}
