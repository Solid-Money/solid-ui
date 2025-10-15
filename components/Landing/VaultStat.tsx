import { View } from 'react-native';

import TooltipPopover from '@/components/Tooltip';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { useAPYs, useTVL } from '@/hooks/useAnalytics';
import { compactNumberFormat } from '@/lib/utils';

const poolCap = 1_000_000;

const CurrentYield = () => {
  const { data } = useAPYs();

  return (
    <View className="gap-1 md:gap-2">
      <View className="flex-row items-center gap-1">
        <Text className="md:text-lg text-muted-foreground font-medium">15D APY</Text>
        <TooltipPopover text="Last 15 days yield of the vault" />
      </View>
      <Text className="text-2xl md:text-4.5xl text-brand font-semibold">
        {data ? `${data.fifteenDay.toFixed(2)}%` : <Skeleton className="w-20 h-8" />}
      </Text>
    </View>
  );
};

const AllTimeYield = () => {
  const { data } = useAPYs();

  return (
    <View className="gap-1 md:gap-2">
      <View className="flex-row items-center gap-1">
        <Text className="md:text-lg text-muted-foreground font-medium">30D APY</Text>
        <TooltipPopover text="Last 30 days yield of the vault" />
      </View>
      <Text className="text-2xl md:text-4.5xl font-semibold">
        {data ? `${data.thirtyDay.toFixed(2)}%` : <Skeleton className="w-20 h-8" />}
      </Text>
    </View>
  );
};

const TVL = () => {
  const { data } = useTVL();

  return (
    <View className="gap-1 md:gap-2">
      <View className="flex-row items-center gap-1">
        <Text className="md:text-lg text-muted-foreground font-medium">TVL</Text>
        <TooltipPopover text="Total value locked in the Solid vault" />
      </View>
      <View className="flex-row items-center">
        <Text className="text-2xl md:text-4.5xl font-semibold">
          {data ? `${compactNumberFormat(data)}$` : <Skeleton className="w-20 h-8" />}
        </Text>
      </View>
    </View>
  );
};

const TVLCap = () => {
  return (
    <View className="gap-1 md:gap-2">
      <View className="flex-row items-center gap-1">
        <Text className="md:text-lg text-muted-foreground font-medium">TVL Cap</Text>
        <TooltipPopover text="The maximum amount that can be deposited into this Solid vault. Once the cap is reached, it may be raised to allow more deposits." />
      </View>
      <View className="flex-row items-center">
        <Text className="text-2xl md:text-4.5xl font-semibold">
          {compactNumberFormat(poolCap)}$
        </Text>
      </View>
    </View>
  );
};

const VaultStat = () => {
  return (
    <View className="md:flex-1 md:basis-1/2 justify-between bg-card rounded-twice p-5 md:p-8 gap-6">
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
