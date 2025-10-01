import { View } from 'react-native';
import { Link } from 'expo-router';
import { ChevronRight } from 'lucide-react-native';

import { Text } from '@/components/ui/text';
import TooltipPopover from '@/components/Tooltip';
import { Skeleton } from '@/components/ui/skeleton';
import { useTotalAPY, useTVL } from '@/hooks/useAnalytics';
import { compactNumberFormat } from '@/lib/utils';
import { path } from '@/constants/path';

const PoolStat = () => {
  const { data: totalAPY } = useTotalAPY();
  const { data: tvl } = useTVL();

  return (
    <Link href={path.OVERVIEW} className="md:flex-1 web:hover:opacity-95">
      <View className="w-full h-full justify-between bg-card rounded-twice p-5 md:px-10 md:py-8 gap-10">
        <View className="flex-row justify-between items-center gap-4">
          <Text className="text-lg text-muted-foreground font-medium">USDC pool stats</Text>

          <View className="flex-row items-center gap-1 web:hover:opacity-70">
            <Text className="text-lg font-medium">Pool overview</Text>
            <ChevronRight size={18} color="white" />
          </View>
        </View>

        <View className="flex-row justify-between items-center gap-4">
          <View>
            <View className="flex-row items-center gap-1">
              <Text className="text-lg text-muted-foreground font-medium">TVL</Text>
              <TooltipPopover text="The total value locked in the Solid vault." />
            </View>
            <Text className="text-2xl font-semibold">
              {tvl ? `${compactNumberFormat(tvl)}$` : <Skeleton className="w-20 h-8" />}
            </Text>
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
              <TooltipPopover text="Annual Percentage Yield (APY): the projected yearly return on your funds based on the vault's performance over the last 15 days." />
            </View>
            <Text className="text-2xl text-brand font-semibold">
              {totalAPY ? `${totalAPY.toFixed(2)}%` : <Skeleton className="w-20 h-8" />}
            </Text>
          </View>
        </View>
      </View>
    </Link>
  );
};

export default PoolStat;
