import { Pressable, TextStyle, View } from 'react-native';
import { Image } from 'expo-image';

import { BALANCE_VALUE_STYLE, MUTED_BALANCE_VALUE_STYLE } from '@/components/BalanceHeadline';
import { TAB_SUMMARY_LABEL, TabSummaryHeadline } from '@/components/TabSummary';
import { Text } from '@/components/ui/text';
import { getTierDisplayName, getTierIcon } from '@/constants/rewards';
import { RewardsTier } from '@/lib/types';
import { compactNumberFormat } from '@/lib/utils';

const SUFFIX_STYLE: TextStyle = {
  fontSize: 16,
  lineHeight: 23,
  fontWeight: '400',
  fontFamily: 'MonaSans_400Regular',
  color: 'rgba(255,255,255,0.7)',
};

interface PointsHeadlineProps {
  tier: RewardsTier;
  points: number;
  badge?: React.ReactNode;
  /**
   * Opens the membership sheet. The tier name is the affordance for it
   * everywhere it appears, so it is a press target here rather than a separate
   * "details" control the design does not have.
   */
  onPressTier?: () => void;
}

/** Current-tier badge + compact points count (e.g. "Prime" / "10.5M Points"). */
const PointsHeadline = ({ tier, points, badge, onPressTier }: PointsHeadlineProps) => {
  const formattedPoints = compactNumberFormat(points ?? 0);
  const numberParts = formattedPoints.match(/^([\d,]+)(\.\d+)?(.*)$/);
  const fadedNumberPart = numberParts ? `${numberParts[2] ?? ''}${numberParts[3] ?? ''}` : '';

  return (
    <TabSummaryHeadline
      label={
        <Pressable
          accessibilityRole={onPressTier ? 'button' : undefined}
          accessibilityLabel={onPressTier ? `${getTierDisplayName(tier)} membership` : undefined}
          onPress={onPressTier}
          disabled={!onPressTier}
          hitSlop={8}
          className="flex-row items-center gap-1.5 transition-opacity active:opacity-70"
        >
          <Image
            source={getTierIcon(tier)}
            style={{ width: 19, height: 19 }}
            contentFit="contain"
            tintColor="rgba(255,255,255,0.7)"
          />
          <Text className={TAB_SUMMARY_LABEL}>{getTierDisplayName(tier)}</Text>
        </Pressable>
      }
      value={
        <View className="flex-row items-baseline">
          <Text className="font-semibold" style={BALANCE_VALUE_STYLE}>
            {numberParts ? numberParts[1] : formattedPoints}
          </Text>
          {fadedNumberPart ? (
            <Text className="font-semibold" style={MUTED_BALANCE_VALUE_STYLE}>
              {fadedNumberPart}
            </Text>
          ) : null}
          <Text style={[SUFFIX_STYLE, { marginLeft: 6 }]}>Points</Text>
        </View>
      }
      badge={badge}
    />
  );
};

export default PointsHeadline;
