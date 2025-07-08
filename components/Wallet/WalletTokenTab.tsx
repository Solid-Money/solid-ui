import { FlashList } from '@shopify/flash-list';
import React, { useMemo, useState } from 'react';
import { Image, LayoutChangeEvent, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { formatUnits } from 'viem';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Text } from '@/components/ui/text';
import { useBalances } from '@/hooks/useBalances';
import { useDimension } from '@/hooks/useDimension';
import { cn, compactNumberFormat, formatNumber, isSoUSDToken } from '@/lib/utils';
import { mainnet } from 'viem/chains';

const MIN_COLUMN_WIDTHS = [50, 50, 200, 200];

// Custom Default Token Icon Component
const DefaultTokenIcon = ({ size = 24, symbol = '?' }: { size?: number; symbol?: string }) => {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: '#6366f1', // Nice purple color
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: '#e5e7eb',
      }}
    >
      <Text
        style={{
          color: 'white',
          fontSize: size * 0.4,
          fontWeight: 'bold',
          textAlign: 'center',
        }}
      >
        {symbol.charAt(0).toUpperCase()}
      </Text>
    </View>
  );
};

const WalletTokenTab = () => {
  const insets = useSafeAreaInsets();
  const [width, setWidth] = useState(0);
  const { isScreenMedium } = useDimension();

  const { ethereumTokens, fuseTokens, isLoading } = useBalances();

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
    const totalMinWidth = MIN_COLUMN_WIDTHS.reduce((sum, width) => sum + width, 0);
    const remainingWidth = Math.max(0, width - totalMinWidth);
    const extraPerColumn = remainingWidth / MIN_COLUMN_WIDTHS.length;

    return MIN_COLUMN_WIDTHS.map((minWidth) => minWidth + extraPerColumn);
  }, [width]);

  const getTokenIcon = (token: any): { type: 'image' | 'component'; source?: any; component?: React.ReactNode } => {
    if (token.logoUrl) {
      return { type: 'image', source: { uri: token.logoUrl } };
    }

    // Fallback to default token icons based on symbol
    switch (token.contractTickerSymbol?.toUpperCase()) {
      case 'USDC':
        return { type: 'image', source: require('@/assets/images/usdc.png') };
      case 'WETH':
      case 'ETH':
        return { type: 'image', source: require('@/assets/images/ethereum-square-4x.png') };
      case 'SOUSD':
        return { type: 'image', source: require('@/assets/images/sousd-4x.png') };
      default:
        return {
          type: 'component',
          component: (
            <DefaultTokenIcon
              size={isScreenMedium ? 34 : 24}
              symbol={token.contractTickerSymbol || 'T'}
            />
          )
        };
    }
  };

  if (isLoading) {
    return (
      <View className="flex-1 justify-center items-center p-8">
        <Text className="text-lg">Loading tokens...</Text>
      </View>
    );
  }

  return (
    <>
      <View className='w-full' onLayout={handleLayout} />
      <ScrollView horizontal bounces={false} showsHorizontalScrollIndicator={false}>
        <Table aria-labelledby='token-table'>
          <TableHeader>
            <TableRow className='border-0 web:hover:bg-transparent'>
              <TableHead className='px-3 md:px-6' style={{ width: columnWidths[0] }}>
                <Text className="text-sm">Asset</Text>
              </TableHead>
              <TableHead className='px-3 md:px-6' style={{ width: columnWidths[1] }}></TableHead>
              <TableHead className='px-3 md:px-6' style={{ width: columnWidths[2] }}>
                <Text className="text-sm">Balance</Text>
              </TableHead>
              <TableHead className='px-3 md:px-6' style={{ width: columnWidths[3] }}>
                <Text className="text-sm">Price</Text>
              </TableHead>
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
                const balance = Number(formatUnits(BigInt(token.balance || '0'), token.contractDecimals));
                const balanceUSD = balance * (token.quoteRate || 0);
                const displayBalance = isScreenMedium ?
                  formatNumber(balance, 4) :
                  balance < 0.001 ?
                    "<0.001" :
                    formatNumber(balance, 3);

                const tokenIcon = getTokenIcon(token);

                return (
                  <TableRow
                    key={`${token.contractAddress}-${token.balance}`}
                    className={cn('bg-card active:bg-secondary items-center border-border/40',
                      index === 0 && 'rounded-t-twice',
                      index === allTokens.length - 1 && 'rounded-b-twice border-0',
                    )}
                  >
                    <TableCell className="p-3 md:p-6" style={{ width: columnWidths[0] }}>
                      <View className='flex-row items-center gap-2'>
                        {tokenIcon.type === 'image' ? (
                          <Image
                            source={tokenIcon.source}
                            style={{ width: isScreenMedium ? 34 : 24, height: isScreenMedium ? 34 : 24 }}
                          />
                        ) : (
                          tokenIcon.component
                        )}
                        <View className='items-start'>
                          <Text className='font-bold'>{token.contractTickerSymbol || 'Unknown'}</Text>
                          <Text className='text-sm text-muted-foreground'>
                            {displayBalance} {isScreenMedium ? token.contractTickerSymbol : ''}
                          </Text>
                        </View>
                      </View>
                    </TableCell>
                    <TableCell className="p-3 md:p-6" style={{ width: columnWidths[1] }}>
                      {isSoUSDToken(token.contractAddress) ? (
                        <View className='bg-primary/5 rounded-full px-4 py-2 self-start'>
                          <Text className='font-semibold'>
                            {token.chainId === mainnet.id ? 'Unstaked' : 'Staked'}
                          </Text>
                        </View>
                      ) : null}
                    </TableCell>
                    <TableCell className="p-3 md:p-6" style={{ width: columnWidths[2] }}>
                      <View className='items-start'>
                        <Text className='font-bold'>${format(token.quoteRate || 0)}</Text>
                        <Text className='text-sm text-muted-foreground'>
                          per {token.contractTickerSymbol}
                        </Text>
                      </View>
                    </TableCell>
                    <TableCell className="p-3 md:p-6" style={{ width: columnWidths[3] }}>
                      <View className='items-start'>
                        <Text className='font-bold'>${format(balanceUSD)}</Text>
                        <Text className='text-sm text-muted-foreground'>
                          {token.contractName || token.contractTickerSymbol}
                        </Text>
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
