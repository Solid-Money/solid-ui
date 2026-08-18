import { View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { cn, formatNumber, formatWholeDollars } from '@/lib/utils';

import RewardsDiamondIcon from './RewardsDiamondIcon';

import type { CashbackDetailsData } from './CashbackDetailsSheet.types';

interface CashbackDetailsContentProps extends CashbackDetailsData {
  onGetMoreCashback: () => void;
  animationSession: number;
  /**
   * Bottom-sheet presentation: adds the top padding that clears the sheet's drag
   * handle. False inside a modal, which brings its own padding.
   */
  isSheet?: boolean;
}

const CashbackDetailsContent = ({
  cashbackRate,
  cashbackThisMonth,
  maxCashbackMonthly,
  allTimeCashback,
  onGetMoreCashback,
  animationSession,
  isSheet = true,
}: CashbackDetailsContentProps) => (
  <View className={cn('items-center', isSheet && 'px-[34px] pt-[46px]')}>
    <RewardsDiamondIcon key={animationSession} />

    <Text
      className="mt-[31px] text-center text-[30px] text-white"
      style={{ fontFamily: 'MonaSans_600SemiBold', lineHeight: 36 }}
    >
      Cashback
    </Text>
    <Text
      className="mt-[7px] w-[284px] text-center text-base text-white/70"
      style={{ fontFamily: 'MonaSans_400Regular', lineHeight: 18 }}
    >
      Earn USDC back on eligible card spend, up to your monthly limit
    </Text>

    <View className="mt-9 h-44 w-full overflow-hidden rounded-twice bg-[#2B2B2B]">
      <View className="h-[59px] flex-row items-center justify-between px-[19px]">
        <Text className="text-base font-medium text-white/70">Your cashback rate</Text>
        <Text className="text-lg font-bold text-[#94F27F]">
          {formatNumber(cashbackRate || 0, 0, 2)}%
        </Text>
      </View>
      <View className="h-px bg-white/10" />
      <View className="h-[58px] flex-row items-center justify-between px-[19px]">
        <Text className="text-base font-medium text-white/70">Cashback this month</Text>
        <Text className="text-lg font-medium">
          <Text className="text-[#94F27F]">{formatWholeDollars(cashbackThisMonth)}</Text>
          <Text className="text-white"> / {formatWholeDollars(maxCashbackMonthly)}</Text>
        </Text>
      </View>
      <View className="h-px bg-white/10" />
      <View className="flex-1 flex-row items-center justify-between px-[19px]">
        <Text className="text-base font-medium text-white/70">All time cashback</Text>
        <Text className="text-lg font-medium text-white">
          {formatWholeDollars(allTimeCashback)}
        </Text>
      </View>
    </View>

    <Text
      className="mt-7 w-full text-base text-white/70"
      style={{ fontFamily: 'MonaSans_400Regular', lineHeight: 18 }}
    >
      Cashback is credited 14 days after the transaction settles and paid straight into your Savings{' '}
      <Text className="font-bold text-white/70 underline" onPress={onGetMoreCashback}>
        Learn more
      </Text>
    </Text>

    <Button
      variant="brand"
      accessibilityRole="button"
      onPress={onGetMoreCashback}
      className="mt-[35px] w-full transition-all active:scale-95 active:opacity-80"
    >
      <Text className="text-black">Get more cashback</Text>
    </Button>
  </View>
);

export default CashbackDetailsContent;
