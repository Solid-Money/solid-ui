import { View } from 'react-native';
import { Image } from 'expo-image';

import { Text } from '@/components/ui/text';
import { CHAIN_ICONS } from '@/constants/chains';
import { CoinBreakdown } from '@/hooks/useCoinBreakdown';
import { cn, formatNumber } from '@/lib/utils';

type CoinBalanceBreakdownProps = {
  breakdown: CoinBreakdown | undefined;
  className?: string;
};

const ICON_SIZE = 37;

/** Per-chain balance rows for a coin, as shown on the mobile coin page. */
const CoinBalanceBreakdown = ({ breakdown, className }: CoinBalanceBreakdownProps) => {
  if (!breakdown || breakdown.items.length === 0) return null;

  return (
    <View className={cn('gap-4', className)}>
      <Text className="text-base font-semibold text-muted-foreground">Balance breakdown</Text>

      <View className="gap-6 rounded-twice bg-card p-5">
        {breakdown.items.map(item => {
          const chainIcon = CHAIN_ICONS[item.chainId];

          return (
            <View key={item.chainId} className="gap-3">
              <View className="flex-row items-center justify-between gap-3">
                <View className="flex-1 flex-row items-center gap-3">
                  {chainIcon && (
                    <Image
                      source={chainIcon}
                      style={{ width: ICON_SIZE, height: ICON_SIZE, borderRadius: ICON_SIZE / 2 }}
                      contentFit="contain"
                    />
                  )}
                  <View className="flex-1">
                    <Text className="text-base font-semibold">{item.chainName}</Text>
                  </View>
                </View>
                <View className="items-end gap-1">
                  <Text className="text-base font-semibold">
                    {formatNumber(item.balance, 3, 0)} {breakdown.symbol}
                  </Text>
                  <Text className="text-base font-medium opacity-50">
                    {formatNumber(item.percentage, 0, 0)}%
                  </Text>
                </View>
              </View>

              <View className="h-[5px] overflow-hidden rounded-full bg-foreground/20">
                <View
                  className="h-full rounded-full bg-foreground/30"
                  style={{ width: `${item.percentage}%` }}
                />
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
};

export default CoinBalanceBreakdown;
