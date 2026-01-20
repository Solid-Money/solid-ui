import { View } from 'react-native';

import TooltipPopover from '@/components/Tooltip';
import Skeleton from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { useAPYs, useTVL } from '@/hooks/useAnalytics';
import { compactNumberFormat } from '@/lib/utils';

const poolCap = 1_000_000;

const CurrentYield = () => {
  const { data } = useAPYs();

  return (
    <View className="gap-1 md:gap-2">
      <View className="flex-row items-center gap-1">
        <Text className="font-medium text-muted-foreground md:text-lg">15D APY</Text>
        <TooltipPopover text="Last 15 days yield of the vault" />
      </View>
      <Text className="text-2xl font-semibold text-brand md:text-3.5xl">
        {data ? `${data.fifteenDay.toFixed(2)}%` : <Skeleton className="h-8 w-20" />}
      </Text>
    </View>
  );
};

const AllTimeYield = () => {
  const { data } = useAPYs();

  return (
    <View className="gap-1 md:gap-2">
      <View className="flex-row items-center gap-1">
        <Text className="font-medium text-muted-foreground md:text-lg">30D APY</Text>
        <TooltipPopover text="Last 30 days yield of the vault" />
      </View>
      <Text className="text-2xl font-semibold md:text-3.5xl">
        {data ? `${data.thirtyDay.toFixed(2)}%` : <Skeleton className="h-8 w-20" />}
      </Text>
    </View>
  );
};

const TVL = () => {
  const { data } = useTVL();

  return (
    <View className="gap-1 md:gap-2">
      <View className="flex-row items-center gap-1">
        <Text className="font-medium text-muted-foreground md:text-lg">TVL</Text>
        <TooltipPopover text="Total value locked in the Solid vault" />
      </View>
      <View className="flex-row items-center">
        <Text className="text-2xl font-semibold md:text-3.5xl">
          {data ? `${compactNumberFormat(data)}$` : <Skeleton className="h-8 w-20" />}
        </Text>
      </View>
    </View>
  );
};

const TVLCap = () => {
  return (
    <View className="gap-1 md:gap-2">
      <View className="flex-row items-center gap-1">
        <Text className="font-medium text-muted-foreground md:text-lg">TVL Cap</Text>
        <TooltipPopover text="The maximum amount that can be deposited into this Solid vault. Once the cap is reached, it may be raised to allow more deposits." />
      </View>
      <View className="flex-row items-center">
        <Text className="text-2xl font-semibold md:text-3.5xl">
          {compactNumberFormat(poolCap)}$
        </Text>
      </View>
    </View>
  );
};

const VaultStat = () => {
  return (
    <View className="justify-between gap-6 rounded-twice bg-card p-5 md:flex-1 md:basis-1/2 md:p-8">
      <View className="flex-row justify-between gap-2">
        <View className="w-7/12 min-w-0">
          <CurrentYield />
        </View>
        <View className="w-5/12 min-w-0">
          <AllTimeYield />
        </View>
      </View>
      <View className="flex-row justify-between gap-2">
        <View className="w-7/12 min-w-0">
          <TVL />
        </View>
        <View className="w-5/12 min-w-0">
          <TVLCap />
        </View>
      </View>
    </View>
  );
};

export default VaultStat;
