import { View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { Text } from '@/components/ui/text';
import { formatBalanceUSD } from '@/lib/utils';

interface RewardsSummaryCardProps {
  cashback: number;
  referrals: number;
}

const RewardsIcon = () => (
  <View className="h-[31px] w-[31px] items-center justify-center">
    <Svg width={21.3615} height={21.3615} viewBox="0 0 21.3615 21.3615" fill="none">
      <Path
        d="M9.48545 1.63291C9.84698 0.455537 11.5145 0.455536 11.8761 1.63291L13.2911 6.24716C13.5587 7.11938 14.2421 7.80283 15.1144 8.07041L19.7286 9.48545C20.906 9.84698 20.906 11.5145 19.7286 11.8761L15.1144 13.2911C14.2421 13.5587 13.5587 14.2421 13.2911 15.1144L11.8761 19.7286C11.5145 20.906 9.84698 20.906 9.48545 19.7286L8.07041 15.1144C7.80283 14.2421 7.11938 13.5587 6.24716 13.2911L1.63291 11.8761C0.455537 11.5145 0.455536 9.84698 1.63291 9.48545L6.24716 8.07041C7.11938 7.80283 7.80283 7.11938 8.07041 6.24716L9.48545 1.63291Z"
        stroke="#94F27F"
        strokeWidth={1.5}
      />
    </Svg>
  </View>
);

/**
 * "Rewards" summary card: Cashback and Referrals split into two columns.
 */
const RewardsSummaryCard = ({ cashback, referrals }: RewardsSummaryCardProps) => {
  return (
    <View className="relative mx-4 h-40 overflow-hidden rounded-twice bg-card">
      <View className="h-16 flex-row items-center px-3">
        <RewardsIcon />
        <Text
          className="ml-[3px] text-lg text-white"
          style={{ fontFamily: 'MonaSans_500Medium', lineHeight: 22 }}
        >
          Rewards
        </Text>
      </View>

      <View className="h-24 flex-row">
        <View className="flex-1 items-center justify-center gap-2.5">
          <Text
            className="text-base text-white/70"
            style={{ fontFamily: 'MonaSans_400Regular', lineHeight: 16 }}
          >
            Cashback
          </Text>
          <Text
            className="text-[26px] text-white"
            style={{ fontFamily: 'MonaSans_600SemiBold', lineHeight: 26 }}
          >
            {formatBalanceUSD(cashback)}
          </Text>
        </View>
        <View className="w-px bg-white/10" />
        <View className="flex-1 items-center justify-center gap-2.5">
          <Text
            className="text-base text-white/70"
            style={{ fontFamily: 'MonaSans_400Regular', lineHeight: 16 }}
          >
            Referrals
          </Text>
          <Text
            className="text-[26px] text-white"
            style={{ fontFamily: 'MonaSans_600SemiBold', lineHeight: 26 }}
          >
            {formatBalanceUSD(referrals)}
          </Text>
        </View>
      </View>

      <View className="absolute left-0 right-0 top-16 h-px bg-white/10" />
    </View>
  );
};

export default RewardsSummaryCard;
