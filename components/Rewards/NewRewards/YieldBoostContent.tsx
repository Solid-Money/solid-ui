import { View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { cn, formatNumber, formatWholeDollars } from '@/lib/utils';

import RewardsDiamondIcon from './RewardsDiamondIcon';

import type { YieldBoostData } from './YieldBoostSheet.types';

interface YieldBoostContentProps extends YieldBoostData {
  onClose: () => void;
  animationSession: number;
  /**
   * Bottom-sheet presentation: adds the top padding that clears the sheet's drag
   * handle. False inside a modal, which brings its own padding.
   */
  isSheet?: boolean;
}

const formatBoost = (percentage: number) => `+${formatNumber(percentage || 0, 2, 0)}%`;

const YieldBoostContent = ({
  yieldBoostPercentage,
  yieldBoostCap,
  yieldBoostEarned,
  onClose,
  animationSession,
  isSheet = true,
}: YieldBoostContentProps) => (
  <View className={cn('items-center', isSheet && 'px-[34px] pt-[46px]')}>
    <RewardsDiamondIcon key={animationSession} />

    <Text
      className="mt-[31px] text-center text-[30px] text-white"
      style={{ fontFamily: 'MonaSans_600SemiBold', lineHeight: 36 }}
    >
      <Text className="text-[30px] text-[#94F27F]" style={{ fontFamily: 'MonaSans_600SemiBold' }}>
        {formatBoost(yieldBoostPercentage)}
      </Text>{' '}
      Yield Boost
    </Text>
    <Text
      className="mt-[7px] w-[284px] text-center text-base text-white/70"
      style={{ fontFamily: 'MonaSans_400Regular', lineHeight: 18 }}
    >
      {yieldBoostCap > 0
        ? `Earn USDC on top of your savings deposits, up to ${formatWholeDollars(yieldBoostCap)}`
        : 'Earn USDC on top of your savings deposits'}
    </Text>

    <View className="mt-9 h-[117px] w-full overflow-hidden rounded-twice bg-[#2B2B2B]">
      <View className="h-[58px] flex-row items-center justify-between px-[19px]">
        <Text className="text-base font-medium text-white/70">Yield Boost</Text>
        <Text className="text-lg font-medium text-[#94F27F]">
          {formatBoost(yieldBoostPercentage)}
        </Text>
      </View>
      <View className="h-px bg-white/10" />
      <View className="flex-1 flex-row items-center justify-between px-[19px]">
        <Text className="text-base font-medium text-white/70">Total earned</Text>
        <Text className="text-lg font-medium text-white">
          {formatWholeDollars(yieldBoostEarned)}
        </Text>
      </View>
    </View>

    <Button
      variant="brand"
      accessibilityRole="button"
      onPress={onClose}
      className="mt-8 w-full transition-all active:scale-95 active:opacity-80"
    >
      <Text className="text-black">Close</Text>
    </Button>
  </View>
);

export default YieldBoostContent;
