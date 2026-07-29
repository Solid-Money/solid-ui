import { View } from 'react-native';
import { Image } from 'expo-image';

import SavingsIcon from '@/assets/images/savings';
import WalletIcon from '@/assets/images/wallet';
import { Text } from '@/components/ui/text';
import { CHAIN_ICONS } from '@/constants/chains';
import { CoinBreakdown, HeldIn } from '@/hooks/useCoinBreakdown';
import { cn, formatNumber } from '@/lib/utils';

type CoinBalanceBreakdownProps = {
  breakdown: CoinBreakdown | undefined;
  className?: string;
};

const ICON_SIZE = 37;

// Sized per glyph so each keeps its own aspect ratio (wallet is 21x21, savings 15x18).
const HELD_IN_ICON_SIZE = {
  [HeldIn.WALLET]: { width: 15, height: 15 },
  [HeldIn.SAVINGS]: { width: 12, height: 14 },
};

/** Per-chain wallet / savings rows for a coin, as shown on the mobile coin page. */
const CoinBalanceBreakdown = ({ breakdown, className }: CoinBalanceBreakdownProps) => {
  if (!breakdown || breakdown.items.length === 0) return null;

  return (
    <View className={cn('gap-4', className)}>
      <Text className="text-base font-semibold text-muted-foreground">Balance breakdown</Text>

      <View className="gap-6 rounded-twice bg-card p-5">
        {breakdown.items.map(item => {
          const chainIcon = CHAIN_ICONS[item.chainId];
          const LocationIcon = item.heldIn === HeldIn.SAVINGS ? SavingsIcon : WalletIcon;

          return (
            <View key={`${item.chainId}-${item.heldIn}`} className="gap-3">
              <View className="flex-row items-center justify-between gap-3">
                <View className="flex-1 flex-row items-center gap-3">
                  {chainIcon && (
                    <Image
                      source={chainIcon}
                      style={{ width: ICON_SIZE, height: ICON_SIZE, borderRadius: ICON_SIZE / 2 }}
                      contentFit="contain"
                    />
                  )}
                  <View className="flex-1 gap-1">
                    <Text className="text-base font-semibold">{item.chainName}</Text>
                    <View className="flex-row items-center gap-1.5 opacity-50">
                      <LocationIcon {...HELD_IN_ICON_SIZE[item.heldIn]} />
                      <Text className="text-base font-medium capitalize">{item.heldIn}</Text>
                    </View>
                  </View>
                </View>
                <View className="items-end gap-1">
                  <Text className="text-base font-semibold">
                    {formatNumber(item.balance, 6, 0)} {breakdown.symbol}
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
