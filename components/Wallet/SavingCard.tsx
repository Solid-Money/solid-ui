import { memo, useMemo, useState } from 'react';
import { Platform, Pressable, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Address } from 'viem';

import SavingsIcon from '@/assets/images/savings';
import CountUp from '@/components/CountUp';
import Ping from '@/components/Ping';
import RenderTokenIcon from '@/components/RenderTokenIcon';
import TooltipPopover from '@/components/Tooltip';
import Skeleton from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { path } from '@/constants/path';
import { VAULTS } from '@/constants/vaults';
import { useMaxAPY } from '@/hooks/useAnalytics';
import { useDimension } from '@/hooks/useDimension';
import { useTotalSavingsUSD } from '@/hooks/useTotalSavingsUSD';
import useUser from '@/hooks/useUser';
import { useVaultBalance } from '@/hooks/useVault';
import getTokenIcon from '@/lib/getTokenIcon';
import { cn, fontSize, formatNumber } from '@/lib/utils';

// Native doesn't resolve bg-purple/50 from CSS vars → dark opaque bar. Use bright transparent overlay to match web.
const nativeSkeletonBg =
  Platform.OS !== 'web' ? ({ backgroundColor: 'rgba(255,255,255,0.28)' } as const) : undefined;

type SavingCardProps = {
  className?: string;
  decimalPlaces?: number;
};

const ACTIVE_VAULTS = VAULTS.filter(v => !('isComingSoon' in v && v.isComingSoon));
const usdcVault = ACTIVE_VAULTS[0];
const fuseVault = ACTIVE_VAULTS[1];

const ICON_SIZE = 28;

const SavingCard = memo(({ className, decimalPlaces = 2 }: SavingCardProps) => {
  const router = useRouter();
  const { isScreenMedium } = useDimension();
  const { maxAPY, isAPYsLoading: isMaxAPYsLoading } = useMaxAPY();
  const { data: totalSavingsUSD, isLoading: isTotalSavingsLoading } = useTotalSavingsUSD();
  const [isHovered, setIsHovered] = useState(false);
  const { user } = useUser();
  const address = user?.safeAddress as Address;
  const { data: balanceUsdc } = useVaultBalance(address, usdcVault);
  const { data: balanceFuse } = useVaultBalance(address, fuseVault);

  const vaultIcons = useMemo(() => {
    const icons: { symbol: string; key: string }[] = [];
    if (balanceUsdc && balanceUsdc > 0) {
      icons.push({ symbol: 'SOUSD', key: 'sousd' });
    }
    if (balanceFuse && balanceFuse > 0) {
      icons.push({ symbol: 'SOFUSE', key: 'sofuse' });
    }
    // Show soUSD by default if user has no balances yet
    if (icons.length === 0) {
      icons.push({ symbol: 'SOUSD', key: 'sousd' });
    }
    return icons;
  }, [balanceUsdc, balanceFuse]);

  return (
    <Pressable
      onPress={() => router.push(path.SAVINGS)}
      onHoverIn={() => setIsHovered(true)}
      onHoverOut={() => setIsHovered(false)}
      className={className}
    >
      <View
        className={cn(
          'relative h-full w-full justify-between overflow-hidden rounded-twice p-5 pb-4 md:p-[30px] md:pb-[21px]',
        )}
      >
        {/* Base gradient */}

        {/* Lighter gradient (5%) revealed on hover */}
        <LinearGradient
          colors={['rgba(122, 84, 234, 0.1)', 'rgba(122, 84, 234, 0.1)']}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.6, y: 1 }}
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: 0,
            bottom: 0,
            zIndex: 0,
            opacity: isHovered ? 1 : 0,
          }}
          className="transition-opacity duration-200"
        />
        <LinearGradient
          colors={['rgba(122, 84, 234, 1)', 'rgba(122, 84, 234, 0.5)']}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.6, y: 1 }}
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: 0,
            bottom: 0,
            zIndex: -1,
            opacity: 0.3,
          }}
        />
        <View className="relative flex-row items-center justify-between">
          <View className="flex-row items-center gap-2 opacity-50">
            <SavingsIcon />
            <Text className="text-lg font-medium">Savings</Text>
          </View>

          <View className="flex-row items-center gap-2 pr-[5px]">
            {isMaxAPYsLoading ? (
              <Skeleton className="h-6 w-24 rounded-xl bg-purple/50" style={nativeSkeletonBg} />
            ) : isScreenMedium ? (
              <Text className="text-sm font-semibold text-brand md:text-base">
                Earning {maxAPY ? `${formatNumber(maxAPY, 2)}%` : '0%'} yield
              </Text>
            ) : (
              <Text className="text-sm font-semibold text-brand md:text-base">
                {maxAPY ? `${formatNumber(maxAPY, 2)}%` : '0%'} APY
              </Text>
            )}
            <Ping />
          </View>
        </View>

        <View className="relative flex-row items-center justify-between">
          <View className="flex-row items-center gap-2">
            <View className="flex-row items-center">
              {isTotalSavingsLoading || isMaxAPYsLoading || totalSavingsUSD === undefined ? (
                <Skeleton className="h-11 w-36 rounded-xl bg-purple/50" style={nativeSkeletonBg} />
              ) : (
                <CountUp
                  prefix="$"
                  count={totalSavingsUSD}
                  decimalPlaces={decimalPlaces}
                  classNames={{
                    wrapper: 'text-foreground',
                    decimalSeparator: 'text-2xl md:text-3xl font-semibold',
                  }}
                  styles={{
                    wholeText: {
                      fontSize: isScreenMedium ? fontSize(1.875) : fontSize(1.5),
                      fontWeight: '500',
                      fontFamily: 'MonaSans_600SemiBold',
                      color: '#ffffff',
                      marginRight: -1,
                    },
                    decimalText: {
                      fontSize: isScreenMedium ? fontSize(1.875) : fontSize(1.5),
                      fontWeight: '500',
                      fontFamily: 'MonaSans_600SemiBold',
                      color: '#ffffff',
                    },
                  }}
                />
              )}
            </View>
            <TooltipPopover text="USDC vault (USD) + FUSE vault (USD)" />
          </View>
          <View className="flex-row">
            {vaultIcons.map((icon, index) => (
              <View
                key={icon.key}
                style={{
                  marginLeft: index > 0 ? -8 : 0,
                  zIndex: vaultIcons.length - index,
                }}
              >
                <RenderTokenIcon
                  tokenIcon={getTokenIcon({ tokenSymbol: icon.symbol, size: ICON_SIZE })}
                  size={ICON_SIZE}
                  tokenName={icon.symbol}
                  priority="high"
                />
              </View>
            ))}
          </View>
        </View>
      </View>
    </Pressable>
  );
});

SavingCard.displayName = 'SavingCard';

export default SavingCard;
