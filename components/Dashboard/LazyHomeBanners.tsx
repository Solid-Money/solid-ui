import React, { Suspense, useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

// Lazy load HomeBanners - this is promotional content at the bottom of the home page
// and doesn't need to be part of the initial bundle for FCP optimization
// This component includes heavy dependencies: react-native-reanimated-carousel,
// PointsBanner, CardBanner, DepositBanner - all deferred for better FCP
const HomeBannersLazy = React.lazy(() => import('./HomeBanners'));

/**
 * Animated skeleton box with pulsing opacity
 */
const SkeletonBox = ({ style }: { style?: object }) => {
  const opacity = useSharedValue(1);

  useEffect(() => {
    opacity.value = withRepeat(
      withSequence(withTiming(0.5, { duration: 1000 }), withTiming(1, { duration: 1000 })),
      -1,
    );
  }, [opacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={[
        {
          height: 156,
          width: '50%',
          backgroundColor: 'rgba(255, 255, 255, 0.2)',
          borderRadius: 12,
        },
        animatedStyle,
        style,
      ]}
    />
  );
};

/**
 * Skeleton fallback for HomeBanners while it loads
 * Matches the approximate dimensions of the banner cards
 */
export const BannersFallback = () => (
  <View className="w-full flex-row gap-4">
    <SkeletonBox />
    <SkeletonBox />
  </View>
);

/**
 * Lazy-loaded wrapper for HomeBanners component
 *
 * PERFORMANCE: HomeBanners contains promotional content and images that aren't
 * critical for the initial page load. By lazy-loading it, we reduce the JS bundle
 * that needs to be parsed before First Contentful Paint (FCP).
 *
 * This improves RES (Real Experience Score) by deferring non-critical content.
 */
const LazyHomeBanners = () => {
  return (
    <Suspense fallback={<BannersFallback />}>
      <HomeBannersLazy />
    </Suspense>
  );
};

export default LazyHomeBanners;
