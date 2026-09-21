import { Image } from 'expo-image';

import { CoreTierSparkle } from '@/assets/images/rewards-tiers/core-tier-icons';
import { RewardsTier } from '@/lib/types';

/**
 * Prime and Ultra ship as artwork; Core is a stroked outline, so it is an SVG.
 * The split is the design's, not an accident of tooling.
 */
const TIER_SPARKLE: Record<RewardsTier.PRIME | RewardsTier.ULTRA, number> = {
  [RewardsTier.PRIME]: require('@/assets/images/rewards-tiers/prime-tier-sparkle.png'),
  [RewardsTier.ULTRA]: require('@/assets/images/rewards-tiers/ultra-tier-sparkle.png'),
};

/** The size the benefits screen draws it beside a tier name. */
const DEFAULT_SIZE = 20;

/**
 * The tier's mark, as a still.
 *
 * The counterpart to `TierHero/TierStar`, which plays the animated WebP. That
 * one earns its weight at 235px on a screen built around it; beside a heading
 * it is a 26 MB bundle and a decoder running for a 28px glyph nobody is looking
 * at. Anywhere the mark is a label rather than the subject, it is this.
 */
const TierSparkleIcon = ({ tier, size = DEFAULT_SIZE }: { tier: RewardsTier; size?: number }) =>
  tier === RewardsTier.CORE ? (
    <CoreTierSparkle width={size} height={size} />
  ) : (
    <Image
      source={TIER_SPARKLE[tier]}
      alt=""
      style={{ width: size, height: size }}
      contentFit="contain"
    />
  );

export default TierSparkleIcon;
