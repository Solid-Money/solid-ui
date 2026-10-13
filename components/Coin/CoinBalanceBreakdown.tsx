import { Fragment } from 'react';
import { View } from 'react-native';
import { Image } from 'expo-image';

import { Text } from '@/components/ui/text';
import { CHAIN_ICONS } from '@/constants/chains';
import { CoinBreakdown } from '@/hooks/useCoinBreakdown';
import { formatTokenAmount } from '@/lib/portfolio';
import { cn, formatNumber } from '@/lib/utils';

type CoinBalanceBreakdownProps = {
  breakdown: CoinBreakdown | undefined;
  className?: string;
  /** Share tokens read like the header above them: "1,449.83 soUSD". */
  isShare?: boolean;
};

const ICON_SIZE = 40;

/** Per-chain balance rows for a coin (Figma 28445:4885): the amount, and what it is worth. */
const CoinBalanceBreakdown = ({ breakdown, className, isShare }: CoinBalanceBreakdownProps) => {
  if (!breakdown || breakdown.items.length === 0) return null;

  return (
    <View className={cn('gap-3', className)}>
      <Text className="text-[16px] leading-5 text-white/50">Balance breakdown</Text>

      <View className="overflow-hidden rounded-[20px] bg-card">
        {breakdown.items.map((item, index) => {
          const chainIcon = CHAIN_ICONS[item.chainId];

          return (
            <Fragment key={item.chainId}>
              {index > 0 && <View className="h-px bg-[#2A2A2A]" />}
              <View className="flex-row items-center gap-3 px-4 py-[14px]">
                {chainIcon ? (
                  <Image
                    source={chainIcon}
                    style={{ width: ICON_SIZE, height: ICON_SIZE, borderRadius: ICON_SIZE / 2 }}
                    contentFit="contain"
                  />
                ) : (
                  <View className="h-10 w-10 rounded-full bg-white/10" />
                )}
                <Text
                  className="min-w-0 flex-1 text-[16px] font-semibold leading-5"
                  numberOfLines={1}
                >
                  {item.chainName}
                </Text>
                <View className="shrink-0 items-end gap-[3px]">
                  <Text className="text-[16px] font-semibold leading-5">
                    {isShare ? formatTokenAmount(item.balance) : formatNumber(item.balance, 3, 0)}{' '}
                    {breakdown.symbol}
                  </Text>
                  <Text className="text-[14px] leading-5 text-white/50">
                    {item.balanceUSD > 0
                      ? `$${formatNumber(item.balanceUSD, 2, 2)}`
                      : `${formatNumber(item.percentage, 0, 0)}%`}
                  </Text>
                </View>
              </View>
            </Fragment>
          );
        })}
      </View>
    </View>
  );
};

export default CoinBalanceBreakdown;
