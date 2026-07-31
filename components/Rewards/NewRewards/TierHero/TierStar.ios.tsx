import { useVideoPlayer, VideoView } from 'expo-video';

import { RewardsTier } from '@/lib/types';

import { TIER_STAR_SIZES, tierStarOffset } from './starLayout';

/**
 * iOS plays the stars as HEVC-with-alpha video rather than animated WebP.
 *
 * Each star is a 422-frame, 470 × 470, 60fps loop with a per-frame alpha
 * plane. expo-image renders animated WebP through SDWebImage's
 * SDAnimatedImageView, which decodes frames on demand into a bounded buffer:
 * decoding a lossy VP8 frame plus its lossless alpha plane costs more than the
 * 17 ms the frame timing allows, so the buffer drains partway through the loop
 * and playback visibly stalls until the loop restarts and refills it — the
 * animation speeds up and slows down on a ~7 second cycle. Gating playback to
 * the visible tier wasn't enough; one star alone is over budget.
 *
 * HEVC with an alpha auxiliary layer is hardware-decoded by VideoToolbox, so
 * the cost is close to zero and only a couple of frames are ever resident.
 * The files are also ~1.5 MB instead of ~9 MB.
 *
 * Android keeps the WebP (see TierStar.tsx) — it decodes off the main thread
 * there and was always smooth, and Android can't decode HEVC alpha anyway.
 *
 * Requires a dev client built after expo-video was added (2026-07-30); an
 * older binary throws "Cannot find native module 'ExpoVideo'".
 *
 * Regenerate the .mov files with scripts/webp-to-hevc-alpha.sh.
 */
const TIER_STAR_VIDEOS: Record<RewardsTier, number> = {
  [RewardsTier.CORE]: require('@/assets/animations/star-1.mov'),
  [RewardsTier.PRIME]: require('@/assets/animations/star-2.mov'),
  [RewardsTier.ULTRA]: require('@/assets/animations/star-3.mov'),
};

const TierStar = ({ tier }: { tier: RewardsTier }) => {
  const player = useVideoPlayer(TIER_STAR_VIDEOS[tier], p => {
    p.loop = true;
    p.muted = true;
    // Silences the "is this playing audio" bookkeeping for a decorative loop,
    // so it never interrupts the user's music or claims the now-playing slot.
    p.audioMixingMode = 'mixWithOthers';
    p.play();
  });

  return (
    <VideoView
      player={player}
      style={{
        width: TIER_STAR_SIZES[tier],
        height: TIER_STAR_SIZES[tier],
        transform: tierStarOffset(tier),
      }}
      contentFit="contain"
      nativeControls={false}
      allowsVideoFrameAnalysis={false}
      // Decorative, and it sits under the pager's swipe gesture.
      pointerEvents="none"
      accessible={false}
    />
  );
};

export default TierStar;
