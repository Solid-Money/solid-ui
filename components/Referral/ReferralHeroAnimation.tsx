import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { Image } from 'expo-image';

import { type AssetPath, getAsset } from '@/lib/assets';

const TIMELINE_DURATION_MS = 2000;

interface AvatarMotion {
  asset: AssetPath;
  height: number;
  initialScale: number;
  initialTranslateX: number;
  left: number;
  opacityEnd: number;
  opacityStart: number;
  top: number;
  transformEnd: number;
  transformStart: number;
  width: number;
}

const AVATARS: AvatarMotion[] = [
  {
    asset: 'images/referral-hero-avatar-back.svg',
    left: 0,
    top: 13.75,
    width: 67.5,
    height: 78.75,
    opacityStart: 0.21,
    opacityEnd: 0.38,
    transformStart: 0.21,
    transformEnd: 0.57,
    initialTranslateX: -80,
    initialScale: 0.92,
  },
  {
    asset: 'images/referral-hero-avatar-middle.svg',
    left: 26.5,
    top: 5,
    width: 80.5,
    height: 95,
    opacityStart: 0.13,
    opacityEnd: 0.3,
    transformStart: 0.13,
    transformEnd: 0.49,
    initialTranslateX: -72.5,
    initialScale: 0.9,
  },
  {
    asset: 'images/referral-hero-avatar-front.svg',
    left: 58.5,
    top: 0,
    width: 91.5,
    height: 108.75,
    opacityStart: 0.05,
    opacityEnd: 0.22,
    transformStart: 0.05,
    transformEnd: 0.41,
    initialTranslateX: -65,
    initialScale: 0.88,
  },
];

const OPACITY_EASING = Easing.bezier(0, 0, 0.58, 1).factory();
const TRANSFORM_EASING = Easing.bezier(0.16, 1, 0.3, 1).factory();

const getPhase = (progress: number, start: number, end: number) => {
  'worklet';

  return Math.min(1, Math.max(0, (progress - start) / (end - start)));
};

const ReferralAvatar = ({
  motion,
  progress,
}: {
  motion: AvatarMotion;
  progress: SharedValue<number>;
}) => {
  const animatedStyle = useAnimatedStyle(() => {
    const opacityPhase = getPhase(progress.value, motion.opacityStart, motion.opacityEnd);
    const transformPhase = getPhase(progress.value, motion.transformStart, motion.transformEnd);
    const easedTransform = TRANSFORM_EASING(transformPhase);

    return {
      opacity: OPACITY_EASING(opacityPhase),
      transform: [
        { translateX: motion.initialTranslateX * (1 - easedTransform) },
        { scale: motion.initialScale + (1 - motion.initialScale) * easedTransform },
      ],
    };
  });

  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          left: motion.left,
          top: motion.top,
          width: motion.width,
          height: motion.height,
        },
        animatedStyle,
      ]}
    >
      <Image
        source={getAsset(motion.asset)}
        style={{ width: motion.width, height: motion.height }}
        contentFit="contain"
      />
    </Animated.View>
  );
};

interface ReferralHeroAnimationProps {
  isActive: boolean;
}

/**
 * Staggered avatar entrance exported from Figma node 21109:698.
 */
export default function ReferralHeroAnimation({ isActive }: ReferralHeroAnimationProps) {
  const progress = useSharedValue(0);

  useEffect(() => {
    cancelAnimation(progress);
    progress.value = 0;

    if (isActive) {
      progress.value = withTiming(1, {
        duration: TIMELINE_DURATION_MS,
        easing: Easing.linear,
      });
    }

    return () => cancelAnimation(progress);
  }, [isActive, progress]);

  return (
    <View style={{ width: 150, height: 109 }}>
      {AVATARS.map(motion => (
        <ReferralAvatar key={motion.asset} motion={motion} progress={progress} />
      ))}
    </View>
  );
}
