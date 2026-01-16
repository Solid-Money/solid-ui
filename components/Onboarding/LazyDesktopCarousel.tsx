import React, { Suspense } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

// Lazy load the heavy carousel component (lottie-react-native ~500KB+)
// This defers loading until the carousel is actually needed on desktop
const DesktopCarousel = React.lazy(() =>
  import('./DesktopCarousel').then(module => ({ default: module.DesktopCarousel })),
);

interface LazyDesktopCarouselProps {
  onHelpCenterPress?: () => void;
}

/**
 * Lightweight fallback that maintains visual structure while the carousel loads.
 * Matches the exact layout of DesktopCarousel to minimize layout shift (CLS).
 * Uses the first slide's gradient colors for visual consistency.
 */
const CarouselFallback = () => (
  <View className="m-4 w-[30%] min-w-[280px] max-w-[400px] overflow-hidden rounded-2xl bg-[#111]">
    {/* Gradient background - matches first slide (purple) */}
    <LinearGradient
      colors={['rgba(122, 84, 234, 0.30)', 'rgba(122, 84, 234, 0.09)']}
      start={{ x: 0.2, y: 0.2 }}
      end={{ x: 0.8, y: 0.8 }}
      style={StyleSheet.absoluteFill}
    />

    {/* Content Container - matches px-6 padding */}
    <View className="flex-1 items-center justify-center px-6">
      {/* Slide area - matches 452px height */}
      <View style={{ position: 'relative', width: '100%', height: 452 }}>
        <View
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {/* Illustration area - 320px height with loader instead of Lottie */}
          <View
            className="relative items-center justify-center"
            style={{ height: 320, width: '100%' }}
          >
            <ActivityIndicator size="large" color="rgba(255,255,255,0.6)" />
          </View>

          {/* Title and Subtitle skeleton - matches 100px height + marginTop 30 */}
          <View className="items-center justify-center" style={{ height: 100, marginTop: 30 }}>
            {/* Title skeleton */}
            <View
              style={{
                width: 200,
                height: 28,
                backgroundColor: 'rgba(255,255,255,0.1)',
                borderRadius: 6,
              }}
            />
            {/* Subtitle skeleton */}
            <View
              style={{
                width: 160,
                height: 20,
                backgroundColor: 'rgba(255,255,255,0.08)',
                borderRadius: 4,
                marginTop: 8,
              }}
            />
          </View>
        </View>
      </View>

      {/* Pagination dots skeleton - matches 24px height + marginTop 40 */}
      <View
        className="flex-row items-center justify-center gap-2"
        style={{ height: 24, marginTop: 40 }}
      >
        {/* Active dot (wider) */}
        <View
          style={{
            width: 20,
            height: 8,
            borderRadius: 4,
            backgroundColor: 'rgba(255,255,255,0.4)',
          }}
        />
        {/* Inactive dots */}
        {[1, 2].map(i => (
          <View
            key={i}
            style={{
              width: 8,
              height: 8,
              borderRadius: 4,
              backgroundColor: 'rgba(255,255,255,0.2)',
            }}
          />
        ))}
      </View>
    </View>
  </View>
);

/**
 * LazyDesktopCarousel - Lazy-loaded wrapper for DesktopCarousel
 *
 * PERFORMANCE OPTIMIZATION:
 * ─────────────────────────────────────────────────────────────────────────
 * This wrapper defers loading of the heavy DesktopCarousel component which
 * imports lottie-react-native (~500KB+) and react-native-reanimated.
 *
 * Benefits:
 * - Improves FCP/LCP on /onboarding, /signup/email, /signup/otp, /welcome
 * - Reduces initial bundle size for mobile users (who don't see this component)
 * - Desktop users see a brief loading state, then the full carousel
 *
 * The fallback maintains the same visual structure (rounded box with gradient)
 * to minimize layout shift when the real carousel loads.
 * ─────────────────────────────────────────────────────────────────────────
 */
const LazyDesktopCarousel = ({ onHelpCenterPress }: LazyDesktopCarouselProps) => {
  return (
    <Suspense fallback={<CarouselFallback />}>
      <DesktopCarousel onHelpCenterPress={onHelpCenterPress} />
    </Suspense>
  );
};

export default LazyDesktopCarousel;
