import { Image } from 'expo-image';
import { useMemo } from 'react';
import { View } from 'react-native';
import { formatUnits } from 'viem';
import { base, fuse, mainnet } from 'viem/chains';

import { Text } from '@/components/ui/text';
import { useWalletTokens } from '@/hooks/useWalletTokens';
import { TokenBalance } from '@/lib/types';
import { cn, formatNumber, isSoUSDToken } from '@/lib/utils';
import { getChain } from '@/lib/wagmi';

import SavingsIcon from '@/assets/images/savings';
import WalletIcon from '@/assets/images/wallet';

enum HeldIn {
  WALLET = 'wallet',
  SAVINGS = 'savings',
}

interface BalanceBreakdownProps {
  token: TokenBalance | undefined;
  className?: string;
}

interface BreakdownItem {
  chainId: number;
  chainName: string;
  heldIn: HeldIn;
  balance: number;
  balanceUSD: number;
  percentage: number;
}

const CHAIN_ICONS: Record<number, any> = {
  [mainnet.id]: require('@/assets/images/eth.png'),
  [fuse.id]: require('@/assets/images/fuse-4x.png'),
  [base.id]: require('@/assets/images/base.png'),
};

const CHAIN_NAMES: Record<number, string> = {
  [mainnet.id]: 'Ethereum',
  [fuse.id]: 'Fuse',
  [base.id]: 'Base',
};

const BalanceBreakdown = ({ token, className }: BalanceBreakdownProps) => {
  const { tokens } = useWalletTokens();

  const breakdown = useMemo(() => {
    if (!token) return null;

    const relatedTokens = token.commonId
      ? tokens.filter(t => t.commonId === token.commonId)
      : tokens.filter(t => t.contractTickerSymbol === token.contractTickerSymbol);

    if (relatedTokens.length === 0) return null;

    let totalBalanceUSD = 0;
    const items: BreakdownItem[] = [];

    relatedTokens.forEach(t => {
      const balance = Number(formatUnits(BigInt(t.balance || '0'), t.contractDecimals));
      const balanceUSD = balance * (t.quoteRate || 0);
      totalBalanceUSD += balanceUSD;

      const heldIn = isSoUSDToken(t.contractAddress) ? HeldIn.SAVINGS : HeldIn.WALLET;
      const chainName = CHAIN_NAMES[t.chainId] || getChain(t.chainId)?.name || 'Unknown';

      items.push({
        chainId: t.chainId,
        chainName,
        heldIn,
        balance,
        balanceUSD,
        percentage: 0,
      });
    });

    items.forEach(item => {
      item.percentage = totalBalanceUSD > 0 ? (item.balanceUSD / totalBalanceUSD) * 100 : 0;
    });

    const grouped = new Map<string, BreakdownItem[]>();
    items.forEach(item => {
      const key = `${item.chainId}-${item.heldIn}`;
      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key)!.push(item);
    });

    const merged: BreakdownItem[] = [];
    grouped.forEach(groupItems => {
      const mergedItem = groupItems.slice(1).reduce(
        (acc, item) => ({
          ...acc,
          balance: acc.balance + item.balance,
          balanceUSD: acc.balanceUSD + item.balanceUSD,
          percentage: acc.percentage + item.percentage,
        }),
        { ...groupItems[0] },
      );
      merged.push(mergedItem);
    });

    merged.sort((a, b) => {
      if (a.chainId !== b.chainId) return a.chainId - b.chainId;
      return a.heldIn === HeldIn.WALLET ? -1 : 1;
    });

    return {
      totalBalanceUSD,
      items: merged,
      totalBalance: relatedTokens.reduce(
        (sum, t) => sum + Number(formatUnits(BigInt(t.balance || '0'), t.contractDecimals)),
        0,
      ),
    };
  }, [token, tokens]);

  if (!breakdown || breakdown.items.length === 0) {
    return (
      <View className="gap-2">
        <Text className="text-lg font-medium opacity-50">Balance across</Text>
      </View>
    );
  }

  const totalBalanceFormatted = formatNumber(breakdown.totalBalance, 6, 0);
  const totalBalanceUSDFormatted = formatNumber(breakdown.totalBalanceUSD, 2, 2);

  return (
    <View className={cn('bg-card rounded-twice border-4 border-popup', className)}>
      <View className="gap-2 justify-center items-center px-4 py-6">
        <Text className="text-lg font-medium opacity-50">Balance across</Text>
        <Text className="text-3.5xl font-semibold">
          {totalBalanceFormatted} {token?.contractTickerSymbol}
        </Text>
        <Text className="text-sm font-medium opacity-50">${totalBalanceUSDFormatted}</Text>
      </View>

      <View className="gap-5 p-5 border-t border-foreground/20">
        <Text className="text-base font-medium opacity-50">Network breakdown</Text>

        <View className="gap-5">
          {breakdown.items.map((item, index) => {
            const chainIcon = CHAIN_ICONS[item.chainId];
            const LocationIcon = item.heldIn === HeldIn.SAVINGS ? SavingsIcon : WalletIcon;

            return (
              <View key={`${item.chainId}-${item.heldIn}-${index}`} className="gap-2">
                <View className="h-1 bg-foreground/20 rounded-full overflow-hidden">
                  <View
                    className="h-full bg-foreground/30 rounded-full"
                    style={{ width: `${item.percentage}%` }}
                  />
                </View>
                <View className="flex-row items-center justify-between">
                  <View className="flex-row items-center gap-3 flex-1">
                    {chainIcon && (
                      <Image
                        source={chainIcon}
                        style={{ width: 40, height: 40 }}
                        contentFit="contain"
                      />
                    )}
                    <View className="flex-1">
                      <Text className="text-base font-semibold">{item.chainName}</Text>
                      <View className="flex-row items-center gap-1 opacity-50">
                        <LocationIcon />
                        <Text className="text-base font-medium capitalize">{item.heldIn}</Text>
                      </View>
                    </View>
                  </View>
                  <View className="items-end">
                    <Text className="text-base font-semibold">
                      {formatNumber(item.balance, 6, 0)} {token?.contractTickerSymbol}
                    </Text>
                    <Text className="text-base font-medium opacity-50">
                      {formatNumber(item.percentage, 0, 0)}%
                    </Text>
                  </View>
                </View>
              </View>
            );
          })}
        </View>
      </View>
    </View>
  );
};

export default BalanceBreakdown;
