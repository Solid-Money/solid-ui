import { TextStyle, View } from 'react-native';
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
}

/** Current-tier badge + compact points count (e.g. "Prime" / "10.5M Points"). */
const PointsHeadline = ({ tier, points }: PointsHeadlineProps) => {
  const formattedPoints = compactNumberFormat(points ?? 0);
  const numberParts = formattedPoints.match(/^([\d,]+)(\.\d+)?(.*)$/);

  return (
    <View className="items-center gap-1 pt-2">
      <View className="flex-row items-center gap-1.5">
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
      </View>
      <View className="flex-row items-baseline">
        <Text style={NUMBER_STYLE}>
          {numberParts ? (
            <>
              {numberParts[1]}
              <Text style={DECIMAL_STYLE}>
                {numberParts[2]}
                {numberParts[3]}
              </Text>
            </>
          ) : (
            formattedPoints
          )}
        </Text>
        <Text style={[SUFFIX_STYLE, { marginLeft: 6 }]}>Points</Text>
      </View>
    </View>
  );
};

export default PointsHeadline;
