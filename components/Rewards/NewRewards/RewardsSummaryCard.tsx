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
    <Svg width={20} height={20} viewBox="0 0 19.8333 19.8333" fill="none">
      <Path
        d="M13.1962 2.01681L15.0296 2.97889C17.002 4.01394 17.9881 4.53146 18.5357 5.46143C19.0833 6.3914 19.0833 7.54861 19.0833 9.86304V9.97029C19.0833 12.2847 19.0833 13.442 18.5357 14.3719C17.9881 15.3019 17.002 15.8194 15.0296 16.8545L13.1962 17.8165C11.5869 18.661 10.7823 19.0833 9.91667 19.0833C9.05106 19.0833 8.24641 18.661 6.6371 17.8165L4.80377 16.8545C2.83141 15.8194 1.84522 15.3019 1.29762 14.3719C0.75 13.442 0.75 12.2847 0.75 9.97029V9.86304C0.75 7.54861 0.75 6.3914 1.29762 5.46143C1.84522 4.53146 2.83141 4.01394 4.80377 2.97889L6.6371 2.01681C8.24641 1.17227 9.05106 0.75 9.91667 0.75C10.7823 0.75 11.5869 1.17227 13.1962 2.01681Z"
        stroke="#94F27F"
        strokeWidth={1.5}
        strokeLinecap="round"
      />
      <Path
        d="M18.1667 5.79167L14.5 7.625M14.5 7.625C14.5 7.625 14.2207 7.76467 14.0417 7.85417C12.4307 8.65964 9.91667 9.91667 9.91667 9.91667M14.5 7.625V10.8333M14.5 7.625L5.79167 3.04167M9.91667 9.91667L1.66667 5.79167M9.91667 9.91667V18.625"
        stroke="#94F27F"
        strokeWidth={1.5}
        strokeLinecap="round"
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
