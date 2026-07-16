import { View } from 'react-native';
import { Image } from 'expo-image';

import { getTierIcon } from '@/constants/rewards';
import { useRewardsUserData } from '@/hooks/useRewards';
import { RewardsTier } from '@/lib/types';

interface RewardsTabIconProps {
  /** The tab-bar icon slot size (matches the other tabs' Lottie icons). */
  size: number;
}

/**
 * Rewards tab icon = the user's CURRENT tier icon (defaults to the first tier).
 * The image is centered in a full `size` box so its baseline matches the other
 * (Lottie) tab icons — giving the same icon↔label gap.
 */
const RewardsTabIcon = ({ size }: RewardsTabIconProps) => {
  const { data } = useRewardsUserData();
  const tier = data?.currentTier ?? RewardsTier.CORE;

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Image
        source={getTierIcon(tier)}
        style={{ width: size * 0.7, height: size * 0.7 }}
        contentFit="contain"
      />
    </View>
  );
};

export default RewardsTabIcon;
