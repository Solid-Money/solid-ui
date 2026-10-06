import { useEffect, useLayoutEffect, useState } from 'react';
import { useVideoPlayer, type VideoPlayer, VideoView } from 'expo-video';

import { RewardsTier } from '@/lib/types';

import { TIER_STAR_SIZES, tierStarOffset } from './starLayout';
import {
  configureTierStarPlayer,
  TIER_STAR_VIDEOS,
  usePreloadedTierStarPlayer,
} from './TierStarPreload.ios';

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
type TierStarProps = {
  tier: RewardsTier;
  size?: number;
  playing?: boolean;
  onReady?: () => void;
  preload?: boolean;
};

const TierStarVideo = ({
  tier,
  size = TIER_STAR_SIZES[tier],
  playing = true,
  onReady,
  player,
}: TierStarProps & { player: VideoPlayer }) => {
  const [hasFrame, setHasFrame] = useState(false);
  useEffect(() => {
    // Warm the first frame once, then pause inactive stars without destroying
    // their player or decoded surface. A slide change can resume immediately.
    if (playing || !hasFrame) player.play();
    else player.pause();
  }, [hasFrame, player, playing]);
  // Stop a borrowed player when leaving benefits. Layout cleanup runs before
  // Expo's passive cleanup releases it if the whole Rewards stack unmounts.
  useLayoutEffect(() => () => player.pause(), [player]);

  return (
    <VideoView
      player={player}
      style={{
        width: size,
        height: size,
        transform: tierStarOffset(tier, size),
      }}
      contentFit="contain"
      nativeControls={false}
      allowsVideoFrameAnalysis={false}
      onFirstFrameRender={() => {
        setHasFrame(true);
        onReady?.();
      }}
      // Decorative, and it sits under the pager's swipe gesture.
      pointerEvents="none"
      accessible={false}
    />
  );
};

const OwnedTierStar = (props: TierStarProps) => {
  const player = useVideoPlayer(TIER_STAR_VIDEOS[props.tier], configureTierStarPlayer);
  return <TierStarVideo {...props} player={player} />;
};

const TierStar = (props: TierStarProps) => {
  const preloaded = usePreloadedTierStarPlayer(props.tier);
  // Only the benefits pager borrows these players. Stars in banners, sheets,
  // and popups still own independent players and cannot pause each other.
  return props.preload && preloaded ? (
    <TierStarVideo {...props} player={preloaded} />
  ) : (
    <OwnedTierStar {...props} />
  );
};

export default TierStar;
