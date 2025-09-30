import { View } from 'react-native';

import { Text } from '@/components/ui/text';
import TooltipPopover from '@/components/Tooltip';
import { Skeleton } from '@/components/ui/skeleton';
import { useTotalAPY, useTVL } from '@/hooks/useAnalytics';
import { compactNumberFormat, formatNumber } from '@/lib/utils';
import { usePreviewDeposit } from '@/hooks/usePreviewDeposit';
import { formatUnits } from 'viem';

const poolCap = 10_000_000;
const soUSD = '1';

const VaultStat = () => {
  const { data: totalAPY } = useTotalAPY();
  const { data: tvl } = useTVL();
  const { exchangeRate } = usePreviewDeposit(soUSD);

  return (
    <View className="md:flex-row justify-between bg-card rounded-twice p-5 md:p-10 gap-6 md:gap-10">
      <View className="gap-2">
        <View className="flex-row items-center gap-1">
          <Text className="text-lg text-muted-foreground font-medium">Pool APY</Text>
          <TooltipPopover text="Annual Percentage Yield (APY): the projected yearly return on your funds based on the vault's performance over the last 15 days." />
        </View>
        <Text className="text-2xl md:text-4.5xl font-semibold">
          {totalAPY ? `${totalAPY.toFixed(2)}%` : <Skeleton className="w-20 h-8" />}
        </Text>
      </View>

      <View className="gap-2">
        <View className="flex-row items-center gap-1">
          <Text className="text-lg text-muted-foreground font-medium">TVL</Text>
          <TooltipPopover
            text={`TVL: Total value locked in the Solid vault.\n\nPool cap: The maximum amount that can be deposited into this Solid vault. Once the cap is reached, it may be raised to allow more deposits.`}
          />
        </View>
        <View className="flex-row items-center">
          <Text className="text-2xl md:text-4.5xl font-semibold">
            {tvl ? `${compactNumberFormat(tvl)}$` : <Skeleton className="w-20 h-8" />}
          </Text>
          <Text className="text-2xl md:text-4.5xl text-muted-foreground font-light">
            /{compactNumberFormat(poolCap)}$
          </Text>
        </View>
      </View>

      <View className="gap-2">
        <View className="flex-row items-center gap-1">
          <Text className="text-lg text-muted-foreground font-medium">Price</Text>
        </View>
        <View className="flex-row items-center">
          <Text className="text-2xl md:text-4.5xl text-muted-foreground font-light">
            {soUSD} soUSD=
          </Text>
          <Text className="text-2xl md:text-4.5xl font-semibold">
            {exchangeRate ? (
              formatNumber(Number(formatUnits(exchangeRate, 6)), 2)
            ) : (
              <Skeleton className="w-20 h-8" />
            )}{' '}
            USD
          </Text>
        </View>
      </View>
    </View>
  );
};

export default VaultStat;
