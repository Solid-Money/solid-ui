import { Pressable, TextStyle, View } from 'react-native';
import { Image } from 'expo-image';

import { Text } from '@/components/ui/text';
import { getTierDisplayName, getTierIcon } from '@/constants/rewards';
import { RewardsTier } from '@/lib/types';

const TIER_STYLE: TextStyle = {
  fontSize: 45,
  fontWeight: '600',
  fontFamily: 'MonaSans_600SemiBold',
  color: '#ffffff',
};
const LABEL_STYLE: TextStyle = {
  fontFamily: 'MonaSans_500Medium',
  fontWeight: '500',
  lineHeight: 23,
};

interface TierHeadlineProps {
  tier: RewardsTier;
  /**
   * Rendered between the label and the tier name — where the design puts the
   * trial countdown, because a tier the user holds only temporarily is the
   * first thing to say about it.
   */
  badge?: React.ReactNode;
  /**
   * Opens the membership sheet. The tier name is the affordance for it
   * everywhere it appears, so it is a press target here rather than a separate
   * "details" control the design does not have.
   */
  onPressTier?: () => void;
}

/**
 * The tier the user holds, as the rewards screen's headline ("Your tier" over a
 * large "Prime").
 *
 * This used to headline the user's points total. Points are deprecated — they
 * no longer move anyone between tiers, which are upgraded only by locking FUSE
 * or an annual membership — so the tier itself is the headline now.
 */
const TierHeadline = ({ tier, badge, onPressTier }: TierHeadlineProps) => (
  <View className="items-center gap-1 pt-2">
    <View className="flex-row items-center gap-1.5">
      <Image
        source={getTierIcon(tier)}
        style={{ width: 19, height: 19 }}
        contentFit="contain"
        tintColor="rgba(255,255,255,0.7)"
      />
      <Text className="text-base text-white/70" style={LABEL_STYLE}>
        Your tier
      </Text>
    </View>
    {badge}
    <Pressable
      accessibilityRole={onPressTier ? 'button' : undefined}
      accessibilityLabel={onPressTier ? `${getTierDisplayName(tier)} membership` : undefined}
      onPress={onPressTier}
      disabled={!onPressTier}
      hitSlop={8}
      className="transition-opacity active:opacity-70"
    >
      <Text style={TIER_STYLE}>{getTierDisplayName(tier)}</Text>
    </Pressable>
  </View>
);

export default TierHeadline;
