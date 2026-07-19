import { View } from 'react-native';
import { Image } from 'expo-image';

import { getAsset } from '@/lib/assets';

interface RewardsTabIconProps {
  /** The tab-bar icon slot size (matches the other tabs' Lottie icons). */
  size: number;
}

/**
 * Rewards tab icon — the pushed white tier-star image, centered in a full `size`
 * box so its baseline (and its icon↔label gap) matches the other tabs. The tab
 * bar dims it via opacity when the tab is inactive.
 */
const RewardsTabIcon = ({ size }: RewardsTabIconProps) => {
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Image
        source={getAsset('images/reward-tier-star.png')}
        style={{ width: size * 0.72, height: size * 0.72 }}
        contentFit="contain"
      />
    </View>
  );
};

export default RewardsTabIcon;
