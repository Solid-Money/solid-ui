import { useCallback, useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { Image } from 'expo-image';

import { RewardsTier } from '@/lib/types';

import { TIER_STAR_SIZES, tierStarOffset } from './starLayout';

// Android and web play the animated WebP smoothly — Glide (and the browser)
// decode it off the main thread. Only iOS needs the video route, so the WebPs
// are required here rather than in the shared parent, which keeps them out of
// the iOS bundle entirely (~26 MB).
export const TIER_STAR_ANIMATIONS: Record<RewardsTier, number> = {
  [RewardsTier.CORE]: require('@/assets/animations/star-1.webp'),
  [RewardsTier.PRIME]: require('@/assets/animations/star-2.webp'),
  [RewardsTier.ULTRA]: require('@/assets/animations/star-3.webp'),
};

const TierStar = ({
  tier,
  size = TIER_STAR_SIZES[tier],
  playing = true,
  onReady,
}: {
  tier: RewardsTier;
  size?: number;
  playing?: boolean;
  onReady?: () => void;
  preload?: boolean;
}) => {
  const image = useRef<Image>(null);
  const syncPlayback = useCallback(() => {
    // Browsers render WebP animation themselves; the playback methods are native-only.
    if (Platform.OS === 'web') return;
    const action = playing ? image.current?.startAnimating() : image.current?.stopAnimating();
    void action?.catch(() => undefined);
  }, [playing]);
  useEffect(syncPlayback, [syncPlayback]);
  return (
    <Image
      ref={image}
      source={TIER_STAR_ANIMATIONS[tier]}
      style={{
        width: size,
        height: size,
        transform: tierStarOffset(tier, size),
      }}
      contentFit="contain"
      cachePolicy="memory-disk"
      autoplay={playing}
      transition={0}
      onLoad={syncPlayback}
      onDisplay={onReady}
      pointerEvents="none"
      accessible={false}
    />
  );
};

export default TierStar;
