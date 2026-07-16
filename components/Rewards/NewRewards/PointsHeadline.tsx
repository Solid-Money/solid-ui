import { TextStyle, View } from 'react-native';

import { Text } from '@/components/ui/text';
import { getTierDisplayName } from '@/constants/rewards';
import { RewardsTier } from '@/lib/types';
import { compactNumberFormat } from '@/lib/utils';

// Same 50px Mona Sans treatment as the redesigned Wallet/Savings headlines, with
// a greyed "pt's" suffix (points are shown compact, e.g. "10.5M").
const NUMBER_STYLE: TextStyle = {
  fontSize: 50,
  fontWeight: '500',
  fontFamily: 'MonaSans_500Medium',
  color: '#ffffff',
};
const SUFFIX_STYLE: TextStyle = {
  ...NUMBER_STYLE,
  fontSize: 32,
  color: '#666666',
};

interface PointsHeadlineProps {
  tier: RewardsTier;
  points: number;
}

/** Current-tier label + big compact points count (e.g. "Prime" / "10.5M pt's"). */
const PointsHeadline = ({ tier, points }: PointsHeadlineProps) => {
  return (
    <View className="items-center gap-1 pt-2">
      <Text className="text-base font-medium text-muted-foreground">
        {getTierDisplayName(tier)}
      </Text>
      <View className="flex-row items-baseline">
        <Text style={NUMBER_STYLE}>{compactNumberFormat(points ?? 0)}</Text>
        <Text style={[SUFFIX_STYLE, { marginLeft: 8 }]}>pt&apos;s</Text>
      </View>
    </View>
  );
};

export default PointsHeadline;
