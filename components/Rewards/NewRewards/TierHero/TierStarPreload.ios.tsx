import { createContext, type PropsWithChildren, useContext, useMemo } from 'react';
import { useVideoPlayer, type VideoPlayer } from 'expo-video';

import { RewardsTier } from '@/lib/types';

export const TIER_STAR_VIDEOS: Record<RewardsTier, number> = {
  [RewardsTier.CORE]: require('@/assets/animations/star-1.mov'),
  [RewardsTier.PRIME]: require('@/assets/animations/star-2.mov'),
  [RewardsTier.ULTRA]: require('@/assets/animations/star-3.mov'),
};

export const configureTierStarPlayer = (player: VideoPlayer) => {
  player.loop = true;
  player.muted = true;
  player.audioMixingMode = 'mixWithOthers';
};

const PreloadedStars = createContext<Record<RewardsTier, VideoPlayer> | null>(null);

export const usePreloadedTierStarPlayer = (tier: RewardsTier) => useContext(PreloadedStars)?.[tier];

export default function TierStarPreloadProvider({ children }: PropsWithChildren) {
  // Paused, unattached players fill their buffers while the Rewards screen is
  // open. Keep ownership here so navigating to benefits reuses that work, and
  // Expo releases all three players when the Rewards stack unmounts.
  const core = useVideoPlayer(TIER_STAR_VIDEOS[RewardsTier.CORE], configureTierStarPlayer);
  const prime = useVideoPlayer(TIER_STAR_VIDEOS[RewardsTier.PRIME], configureTierStarPlayer);
  const ultra = useVideoPlayer(TIER_STAR_VIDEOS[RewardsTier.ULTRA], configureTierStarPlayer);
  const players = useMemo(
    () => ({ [RewardsTier.CORE]: core, [RewardsTier.PRIME]: prime, [RewardsTier.ULTRA]: ultra }),
    [core, prime, ultra],
  );

  return <PreloadedStars.Provider value={players}>{children}</PreloadedStars.Provider>;
}
