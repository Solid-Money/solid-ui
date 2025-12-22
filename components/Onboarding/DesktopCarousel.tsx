import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import LottieView from 'lottie-react-native';
import { useCallback, useEffect, useRef } from 'react';
import { Pressable, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import { Text } from '@/components/ui/text';
import { getBackgroundImage, getGradientColors, ONBOARDING_DATA } from '@/lib/types/onboarding';
import { useCarouselStore } from '@/store/useCarouselStore';

const SWIPE_THRESHOLD = 20; // Minimum distance to trigger slide change

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
  const animationRef = useRef<LottieView>(null);
  const currentSlide = ONBOARDING_DATA[currentIndex];
  const backgroundImage = getBackgroundImage(currentIndex);
  const gradientColors = getGradientColors(currentIndex);
  const startX = useSharedValue(0);

  useEffect(() => {
    if (animationRef.current && !currentSlide.isLastPage) {
      animationRef.current.play();
    }
  }, [currentIndex, currentSlide.isLastPage]);

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
          // Swiped right -> go to previous
          runOnJS(goToPrev)();
        } else {
          // Swiped left -> go to next
          runOnJS(goToNext)();
        }
      }
    });

  return (
    <View className="w-[30%] min-w-[280px] max-w-[400px] rounded-2xl m-4 overflow-hidden bg-[#111]">
      <LinearGradient
        colors={gradientColors}
        start={{ x: 0.2, y: 0.2 }}
        end={{ x: 0.8, y: 0.8 }}
        style={{ flex: 1 }}
      >
        {/* Help Center Link */}
        {/* <Pressable
          onPress={handleHelpCenter}
          className="absolute top-6 left-6 z-10 web:hover:opacity-70"
        >
          <Text className="text-white text-base font-semibold">Help center</Text>
        </Pressable> */}

        {/* Content Container - Vertically centered group with gesture detection */}
        <GestureDetector gesture={panGesture}>
          <View className="flex-1 justify-center items-center px-6">
            <View className="items-center">
              {/* Illustration with background - Fixed height */}
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
                  {currentSlide.image ? (
                    <Image
                      source={currentSlide.image}
                      alt={currentSlide.title}
                      style={{ width: 280, height: 280 }}
                      contentFit="contain"
                    />
                  ) : currentSlide.animation ? (
                    <View
                      style={{
                        transform: [{ scale: 1.6 }],
                        ...(currentIndex === 2 && { marginRight: 20 }),
                      }}
                    >
                      <LottieView
                        ref={animationRef}
                        source={currentSlide.animation}
                        autoPlay={false}
                        loop
                        style={{
                          width: 280,
                          height: 280,
                        }}
                        resizeMode="cover"
                      />
                    </View>
                  ) : null}
                </View>
              </View>

              {/* Title and Subtitle - Fixed height */}
              <View
                className="items-center justify-center px-4"
                style={{ height: 100, marginTop: 32 }}
              >
                {currentSlide.title && (
                  <>
                    <Text className="text-white text-2xl font-semibold text-center tracking-tight">
                      {currentSlide.title}
                    </Text>
                    {currentSlide.subtitle && (
                      <Text className="text-white/70 text-lg text-center mt-2">
                        {currentSlide.subtitle}
                      </Text>
                    )}
                  </>
                )}
              </View>

              {/* Pagination - Fixed height */}
              <View className="items-center" style={{ height: 24, marginTop: 24 }}>
                <InteractivePagination
                  currentIndex={currentIndex}
                  totalSlides={ONBOARDING_DATA.length}
                  onIndexChange={handleIndexChange}
                />
              </View>
            </View>
          </View>
        </GestureDetector>
      </LinearGradient>
    </View>
  );
}
