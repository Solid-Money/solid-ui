import { Pressable, TextStyle, View } from 'react-native';
import { Image } from 'expo-image';

import { Text } from '@/components/ui/text';
import { getTierDisplayName, getTierIcon } from '@/constants/rewards';
import { RewardsTier } from '@/lib/types';
import { compactNumberFormat } from '@/lib/utils';

const NUMBER_STYLE: TextStyle = {
  fontSize: 45,
  fontWeight: '600',
  fontFamily: 'MonaSans_600SemiBold',
  color: '#ffffff',
};
const DECIMAL_STYLE: TextStyle = {
  ...NUMBER_STYLE,
  color: 'rgba(255, 255, 255, 0.5)',
};
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
  /**
   * Rendered between the tier name and the points count — where the design puts
   * the trial countdown, because a tier the user holds only temporarily is the
   * first thing to say about the tier just above it.
   */
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
    <View className="items-center gap-1 pt-2">
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
        <Text
          className="text-base text-white/70"
          style={{ fontFamily: 'MonaSans_500Medium', fontWeight: '500', lineHeight: 23 }}
        >
          {getTierDisplayName(tier)}
        </Text>
      </Pressable>
      {badge}
      <View className="flex-row items-baseline">
        <Text style={NUMBER_STYLE}>{numberParts ? numberParts[1] : formattedPoints}</Text>
        {fadedNumberPart ? <Text style={DECIMAL_STYLE}>{fadedNumberPart}</Text> : null}
        <Text style={[SUFFIX_STYLE, { marginLeft: 6 }]}>Points</Text>
      </View>
    </View>
  );
};

export default PointsHeadline;
