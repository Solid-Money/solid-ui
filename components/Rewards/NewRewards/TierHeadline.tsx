import { Pressable, View } from 'react-native';
import { Image } from 'expo-image';

import { BALANCE_VALUE_STYLE } from '@/components/BalanceHeadline';
import { TAB_SUMMARY_LABEL, TabSummaryHeadline } from '@/components/TabSummary';
import { Text } from '@/components/ui/text';
import { getTierDisplayName, getTierIcon } from '@/constants/rewards';
import { RewardsTier } from '@/lib/types';

interface TierHeadlineProps {
  tier: RewardsTier;
  /**
   * Rendered under the tier name — where the design puts the trial countdown,
   * because a tier the user holds only temporarily is the first thing to say
   * about it.
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
 * The tier the user holds, as the rewards tab's headline ("Your tier" over a
 * large "Prime"), laid out like every other tab's summary headline.
 *
 * This used to headline the user's points total. Points are deprecated — they
 * no longer move anyone between tiers, which are upgraded only by locking FUSE
 * or an annual membership — so the tier itself is the headline now.
 */
const TierHeadline = ({ tier, badge, onPressTier }: TierHeadlineProps) => (
  <TabSummaryHeadline
    label={
      <View className="flex-row items-center gap-1.5">
        <Image
          source={getTierIcon(tier)}
          style={{ width: 19, height: 19 }}
          contentFit="contain"
          tintColor="rgba(255,255,255,0.7)"
        />
        <Text className={TAB_SUMMARY_LABEL}>Your tier</Text>
      </View>
    }
    value={
      <Pressable
        accessibilityRole={onPressTier ? 'button' : undefined}
        accessibilityLabel={onPressTier ? `${getTierDisplayName(tier)} membership` : undefined}
        onPress={onPressTier}
        disabled={!onPressTier}
        hitSlop={8}
        className="transition-opacity active:opacity-70"
      >
        <Text className="font-semibold" style={BALANCE_VALUE_STYLE}>
          {getTierDisplayName(tier)}
        </Text>
      </Pressable>
    }
    badge={badge}
  />
);

export default TierHeadline;
