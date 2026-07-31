import { StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';

import { type AssetPath, getAsset } from '@/lib/assets';
import { RewardsTier } from '@/lib/types';

import TierStar from './TierStar';

const TIER_HERO_GLOW_ASSET: AssetPath = 'images/rewards-tiers/glow.svg';

/**
 * A tier's animated star over its radial glow. Keeping the glow as a separate
 * layer lets it fade into the page instead of exposing the edge of the star's
 * own canvas.
 *
 * The star itself is platform-split — see TierStar.ios.tsx for why.
 */
const TierHero = ({ tier }: { tier: RewardsTier }) => (
  <View className="h-[320px] w-[320px] items-center justify-center">
    <View className="h-[304px] w-[304px] items-center justify-center">
      <Image
        source={getAsset(TIER_HERO_GLOW_ASSET)}
        style={[StyleSheet.absoluteFillObject, { opacity: 0.5 }]}
        contentFit="contain"
      />
      <TierStar tier={tier} />
    </View>
  </View>
);

export default TierHero;
