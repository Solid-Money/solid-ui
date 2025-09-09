import { Image } from 'expo-image';
import { Plus } from 'lucide-react-native';
import { View } from 'react-native';

import { DepositOptionModal } from '@/components/DepositOption';
import TooltipPopover from '@/components/Tooltip';
import { buttonVariants } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { useTotalAPY } from '@/hooks/useAnalytics';

const ExtraYield = () => {
  const { data: totalAPY } = useTotalAPY();

  const getTrigger = () => {
    return (
      <View
        className={buttonVariants({
          variant: 'accent',
          className: 'h-12 pr-6 rounded-xl',
        })}
      >
        <View className="flex-row items-center gap-2">
          <Plus color="white" />
          <Text className="font-bold">Start earning</Text>
        </View>
      </View>
    );
  };

  return (
    <View className="bg-card rounded-twice px-4 py-6 md:px-10 md:py-6 md:flex-row md:items-center justify-between gap-4">
      <View className="md:flex-row md:items-center gap-4">
        <Image
          source={require('@/assets/images/three-percent.png')}
          style={{ width: 70, height: 70 }}
          contentFit="contain"
        />
        <View>
          <Text className="text-2xl font-bold">Get extra 3% for your early support!</Text>
          <View className="flex-row items-center gap-1">
            <Text className="text-muted-foreground font-medium">Get +3% APY for 2 months.</Text>
            <TooltipPopover text="Deposit $100+ and earn an extra 3% APY for 2 months." />
          </View>
        </View>
      </View>

      <View>
        <View className="flex-row items-center gap-1">
          <Text className="text-lg text-muted-foreground font-medium">Pool cap</Text>
          <TooltipPopover text="The maximum amount that can be deposited into this Solid vault. Once the cap is reached, it may be raised to allow more deposits." />
        </View>
        <Text className="text-2xl font-semibold">1M$</Text>
      </View>

      <View>
        <View className="flex-row items-center gap-1">
          <Text className="text-lg text-muted-foreground font-medium">Pool APY</Text>
          <TooltipPopover text="Annual Percentage Yield (APY): the projected yearly return on your funds, shown as a percentage." />
        </View>
        <Text className="text-2xl font-semibold">
          {totalAPY ? `${totalAPY.toFixed(2)}%` : <Skeleton className="w-20 h-8" />}
        </Text>
      </View>

      <DepositOptionModal trigger={getTrigger()} />
    </View>
  );
};

export default ExtraYield;
