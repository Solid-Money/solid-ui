import { FlashList } from '@shopify/flash-list';
import React, { useMemo, useState } from 'react';
import { LayoutChangeEvent, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Address, formatUnits } from 'viem';

import Ping from '@/components/Ping';
import RenderTokenIcon from '@/components/RenderTokenIcon';
import SendModal from '@/components/SendModal/SendModal';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Text } from '@/components/ui/text';
import UnstakeModal from '@/components/Unstake/UnstakeModal';
import WithdrawModal from '@/components/Withdraw/WithdrawModal';
import { useDimension } from '@/hooks/useDimension';
import { useWalletTokens } from '@/hooks/useWalletTokens';
import getTokenIcon from '@/lib/getTokenIcon';
import { cn, compactNumberFormat, formatNumber, isSoUSDEthereum, isSoUSDFuse } from '@/lib/utils';

const WalletTokenTab = () => {
  const insets = useSafeAreaInsets();
  const [width, setWidth] = useState(0);
  const { isScreenMedium } = useDimension();

  const { ethereumTokens, fuseTokens } = useWalletTokens();

  // Combine and sort tokens by USD value (descending)
  const allTokens = useMemo(() => {
    const combined = [...ethereumTokens, ...fuseTokens];
    return combined.sort((a, b) => {
      const balanceA = Number(formatUnits(BigInt(a.balance || '0'), a.contractDecimals));
      const balanceUSD_A = balanceA * (a.quoteRate || 0);

      const balanceB = Number(formatUnits(BigInt(b.balance || '0'), b.contractDecimals));
      const balanceUSD_B = balanceB * (b.quoteRate || 0);

      return balanceUSD_B - balanceUSD_A; // Descending order
    });
  }, [ethereumTokens, fuseTokens]);

  const format = isScreenMedium ? formatNumber : compactNumberFormat;

  const handleLayout = (e: LayoutChangeEvent) => {
    const { width } = e.nativeEvent.layout;
    setWidth(width);
  };

  const columnWidths = useMemo(() => {
    const COLUMN_WIDTHS = isScreenMedium ? [0.15, 0.15, 0.3, 0.2, 0.2] : [0.3, 0, 0.3, 0, 0.4];
    const offset = isScreenMedium ? 0 : 32;

    return COLUMN_WIDTHS.map(ratio => (width - offset) * ratio);
  }, [width, isScreenMedium]);

  return (
    <>
      <View className="flex-1" onLayout={handleLayout} />
      <ScrollView horizontal bounces={false} showsHorizontalScrollIndicator={false}>
        <Table aria-labelledby="token-table">
          <TableHeader>
            <TableRow className="border-0 web:hover:bg-transparent">
              <TableHead
                className="h-0 md:h-full md:px-6 md:py-2"
                style={{ width: columnWidths[0] }}
              >
                <Text className="hidden md:block text-sm">Asset</Text>
              </TableHead>
              <TableHead
                className="hidden md:block h-0 md:h-full md:px-6 md:py-2"
                style={{ width: columnWidths[1] }}
              ></TableHead>
              <TableHead
                className="h-0 md:h-full md:px-6 md:py-2"
                style={{ width: columnWidths[2] }}
              >
                <Text className="hidden md:block text-sm">Balance</Text>
              </TableHead>
              <TableHead
                className="h-0 md:h-full md:px-6 md:py-2"
                style={{ width: columnWidths[3] }}
              >
                <Text className="hidden md:block text-sm">Price</Text>
              </TableHead>
              <TableHead
                className="h-0 md:h-full md:px-6 md:py-2"
                style={{ width: columnWidths[4] }}
              ></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <FlashList
              data={allTokens}
              estimatedItemSize={45}
              contentContainerStyle={{
                paddingBottom: insets.bottom,
              }}
              showsVerticalScrollIndicator={false}
              renderItem={({ item: token, index }) => {
                const balance = Number(
                  formatUnits(BigInt(token.balance || '0'), token.contractDecimals),
                );
                const balanceUSD = balance * (token.quoteRate || 0);

                const tokenIcon = getTokenIcon({
                  logoUrl: token.logoUrl,
                  tokenSymbol: token.contractTickerSymbol,
                  size: isScreenMedium ? 34 : 24,
                });

                return (
                  <TableRow
                    key={`${token.contractAddress}-${token.balance}`}
                    className={cn(
                      'flex-row justify-between md:justify-start bg-card active:bg-secondary items-center border-border/40',
                      index === 0 && 'rounded-t-twice',
                      index === allTokens.length - 1 && 'rounded-b-twice border-0',
                    )}
                  >
                    <TableCell className="p-3 md:p-6" style={{ width: columnWidths[0] }}>
                      <View className="flex-row items-center gap-2">
                        <RenderTokenIcon tokenIcon={tokenIcon} size={isScreenMedium ? 34 : 24} />
                        <View className="items-start">
                          <Text className="font-bold">
                            {token.contractTickerSymbol || 'Unknown'}
                          </Text>
                          <Text className="text-sm text-muted-foreground">
                            {format(balance)} {isScreenMedium ? token.contractTickerSymbol : ''}
                          </Text>
                        </View>
                      </View>
                    </TableCell>
                    <TableCell
                      className="hidden md:block p-3 md:p-6"
                      style={{ width: columnWidths[1] }}
                    >
                      {isSoUSDFuse(token.contractAddress) ? (
                        <View className="bg-brand/20 rounded-full px-2 py-1 md:px-4 md:py-2 flex-row items-center gap-2 w-fit">
                          <Ping />
                          <Text className="text-brand font-semibold">Staking</Text>
                        </View>
                      ) : null}
                    </TableCell>
                    <TableCell className="p-3 md:p-6" style={{ width: columnWidths[2] }}>
                      <View className="items-end md:items-start">
                        <Text className="font-bold">${format(balanceUSD)}</Text>
                      </View>
                    </TableCell>
                    <TableCell
                      className="hidden md:block md:p-6"
                      style={{ width: columnWidths[3] }}
                    >
                      <View className="items-start">
                        <Text className="font-bold">${format(token.quoteRate || 0)}</Text>
                      </View>
                    </TableCell>
                    <TableCell className="p-3 pl-0 md:p-6" style={{ width: columnWidths[4] }}>
                      <View className="flex-row items-center justify-end gap-2">
                        <SendModal
                          tokenAddress={token.contractAddress as Address}
                          tokenDecimals={token.contractDecimals}
                          tokenIcon={tokenIcon}
                          tokenSymbol={token.contractTickerSymbol || 'Unknown'}
                          chainId={token.chainId}
                        />
                        {isSoUSDFuse(token.contractAddress) ? (
                          <UnstakeModal />
                        ) : isSoUSDEthereum(token.contractAddress) ? (
                          <WithdrawModal />
                        ) : null}
                      </View>
                    </TableCell>
                  </TableRow>
                );
              }}
            />
          </TableBody>
        </Table>
      </ScrollView>
    </>
  );
};

export default WalletTokenTab;
