import { useCallback, useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  clamp,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import LottieView from 'lottie-react-native';

import { Text } from '@/components/ui/text';
import { getBackgroundImage, GRADIENT_COLORS, ONBOARDING_DATA } from '@/lib/types/onboarding';
import { useCarouselStore } from '@/store/useCarouselStore';

import { useGradientStyles } from './useGradientStyles';

// Drag distance (in pixels) to move one full slide
const DRAG_DISTANCE_PER_SLIDE = 200;
// Spring config for snapping
const SNAP_SPRING_CONFIG = { damping: 20, stiffness: 200 };

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
 * Supports real-time horizontal swipe/drag navigation with gesture feedback.
 */
export function DesktopCarousel({ onHelpCenterPress }: DesktopCarouselProps) {
  const { currentIndex, setCurrentIndex } = useCarouselStore();

  // Continuous progress value (0-2 range) - drives all animations
  const progress = useSharedValue(currentIndex);
  // Track if we're currently dragging
  const isDragging = useSharedValue(false);

  // Sync progress when currentIndex changes externally (e.g., dot click)
  useEffect(() => {
    if (!isDragging.value) {
      progress.value = withSpring(currentIndex, SNAP_SPRING_CONFIG);
    }
  }, [currentIndex, progress, isDragging]);

  // Update store when progress settles to a new index
  const syncIndexToStore = useCallback(
    (index: number) => {
      if (index !== currentIndex) {
        setCurrentIndex(index);
      }
    },
    [currentIndex, setCurrentIndex],
  );

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

  const filteredOnboardingData = ONBOARDING_DATA.filter(slide => slide?.platform !== false);
  const maxIndex = filteredOnboardingData.length - 1;

  // Pan gesture with real-time tracking
  const panGesture = Gesture.Pan()
    .onStart(() => {
      isDragging.value = true;
    })
    .onUpdate(e => {
      'worklet';
      // Convert drag to progress: negative translationX = moving forward (increasing index)
      const dragOffset = -e.translationX / DRAG_DISTANCE_PER_SLIDE;
      const newProgress = clamp(currentIndex + dragOffset, 0, maxIndex);
      progress.value = newProgress;
    })
    .onEnd(e => {
      'worklet';
      isDragging.value = false;

      // Calculate velocity-aware target
      const velocity = -e.velocityX / DRAG_DISTANCE_PER_SLIDE;
      const projectedProgress = progress.value + velocity * 0.1;

      // Snap to nearest index
      const targetIndex = clamp(Math.round(projectedProgress), 0, maxIndex);

      progress.value = withSpring(targetIndex, SNAP_SPRING_CONFIG);
      runOnJS(syncIndexToStore)(targetIndex);
    });

  // Use shared hook for gradient opacity styles
  const gradientStyles = useGradientStyles(progress);

  // Content animated styles for each slide (crossfade + slight translate)
  const contentStyle0 = useAnimatedStyle(() => {
    'worklet';
    const opacity = interpolate(progress.value, [-0.5, 0, 0.5, 1], [0, 1, 1, 0], 'clamp');
    const translateX = interpolate(progress.value, [0, 1], [0, -30], 'clamp');
    const scale = interpolate(progress.value, [-0.5, 0, 1], [0.95, 1, 0.95], 'clamp');
    return { opacity, transform: [{ translateX }, { scale }] };
  });

  const contentStyle1 = useAnimatedStyle(() => {
    'worklet';
    const opacity = interpolate(progress.value, [0, 0.5, 1, 1.5, 2], [0, 0, 1, 1, 0], 'clamp');
    const translateX = interpolate(progress.value, [0, 1, 2], [30, 0, -30], 'clamp');
    const scale = interpolate(progress.value, [0, 1, 2], [0.95, 1, 0.95], 'clamp');
    return { opacity, transform: [{ translateX }, { scale }] };
  });

  const contentStyle2 = useAnimatedStyle(() => {
    'worklet';
    const opacity = interpolate(progress.value, [1, 1.5, 2, 2.5], [0, 0, 1, 1], 'clamp');
    const translateX = interpolate(progress.value, [1, 2], [30, 0], 'clamp');
    const scale = interpolate(progress.value, [1, 2, 2.5], [0.95, 1, 1], 'clamp');
    return { opacity, transform: [{ translateX }, { scale }] };
  });

  const contentStyle3 = useAnimatedStyle(() => {
    'worklet';
    const opacity = interpolate(progress.value, [2, 2.5, 3], [0, 0, 1], 'clamp');
    const translateX = interpolate(progress.value, [2, 3], [30, 0], 'clamp');
    const scale = interpolate(progress.value, [2, 3], [0.95, 1], 'clamp');
    return { opacity, transform: [{ translateX }, { scale }] };
  });

  const contentStyles = [contentStyle0, contentStyle1, contentStyle2, contentStyle3];

  const filteredGradientColors = GRADIENT_COLORS.filter(
    (_, index) => index < filteredOnboardingData.length,
  );

  return (
    <View className="m-4 w-[30%] min-w-[280px] max-w-[400px] overflow-hidden rounded-2xl bg-[#111]">
      {/* Stacked gradient backgrounds for crossfade effect */}
      {filteredGradientColors.map((colors, index) => (
        <Animated.View
          key={`gradient-${index}`}
          style={[StyleSheet.absoluteFill, gradientStyles[index]]}
        >
          <LinearGradient
            colors={colors}
            start={{ x: 0.2, y: 0.2 }}
            end={{ x: 0.8, y: 0.8 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
      ))}

      {/* Content Container */}
      <GestureDetector gesture={panGesture}>
        <View className="flex-1 items-center justify-center px-6">
          {/* All slides stacked, animated based on progress */}
          <View style={{ position: 'relative', width: '100%', height: 452 }}>
            {filteredOnboardingData.map((slide, index) => {
              const backgroundImage = getBackgroundImage(index);
              return (
                <Animated.View
                  key={`slide-${index}`}
                  style={[
                    {
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0,
                      alignItems: 'center',
                      justifyContent: 'center',
                    },
                    contentStyles[index],
                  ]}
                >
                  {/* Illustration with background */}
                  <View className="relative items-center justify-center" style={{ height: 320 }}>
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
                          ...(index === 2 && { marginRight: 20 }),
                        }}
                      >
                        {slide.image ? (
                          <Image
                            source={slide.image.source}
                            style={{ width: slide.image.width, height: slide.image.height }}
                            contentFit="contain"
                          />
                        ) : (
                          <LottieView
                            key={`lottie-${index}`}
                            source={slide.animation}
                            autoPlay
                            loop
                            style={{ width: 280, height: 280 }}
                            resizeMode="cover"
                          />
                        )}
                      </View>
                    </View>
                  </View>

                  {/* Title and Subtitle */}
                  <View
                    className="items-center justify-center"
                    style={{ height: 100, marginTop: 30 }}
                  >
                    {slide.title && (
                      <>
                        <Text className="text-center text-[28px] font-semibold tracking-tight text-white">
                          {slide.title}
                        </Text>
                        {slide.subtitle && (
                          <Text className="mt-2 text-center text-[20px] leading-6 text-white/70">
                            {slide.subtitle}
                          </Text>
                        )}
                      </>
                    )}
                  </View>
                </Animated.View>
              );
            })}
          </View>

          {/* Pagination - outside animated content so it stays stable */}
          <View className="items-center" style={{ height: 24, marginTop: 40 }}>
            <InteractivePagination
              currentIndex={currentIndex}
              totalSlides={filteredOnboardingData.length}
              onIndexChange={handleIndexChange}
            />
          </View>
        </View>
      </GestureDetector>
    </View>
  );
}
