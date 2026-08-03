import { Image } from 'expo-image';

import { RewardsTier } from '@/lib/types';

import { TIER_STAR_SIZES, tierStarOffset } from './starLayout';

// Android and web play the animated WebP smoothly — Glide (and the browser)
// decode it off the main thread. Only iOS needs the video route, so the WebPs
// are required here rather than in the shared parent, which keeps them out of
// the iOS bundle entirely (~26 MB).
const TIER_STAR_ANIMATIONS: Record<RewardsTier, number> = {
  [RewardsTier.CORE]: require('@/assets/animations/star-1.webp'),
  [RewardsTier.PRIME]: require('@/assets/animations/star-2.webp'),
  [RewardsTier.ULTRA]: require('@/assets/animations/star-3.webp'),
};

const TierStar = ({ tier, size = TIER_STAR_SIZES[tier] }: { tier: RewardsTier; size?: number }) => (
  <Image
    source={TIER_STAR_ANIMATIONS[tier]}
    style={{
      width: size,
      height: size,
      transform: tierStarOffset(tier),
    }}
    contentFit="contain"
    autoplay
  />
);

export default TierStar;
