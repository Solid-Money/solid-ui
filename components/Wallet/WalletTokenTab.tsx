import { FlashList } from '@shopify/flash-list';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { LayoutChangeEvent, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { formatUnits } from 'viem';

import DepositModal from '@/components/Deposit/DepositModal';
import RenderTokenIcon from '@/components/RenderTokenIcon';
import SendModal from '@/components/Send/SendModal';
import StakeModal from '@/components/Stake/StakeModal';
import TooltipPopover from '@/components/Tooltip';
import { TransactionCredenzaTrigger } from '@/components/Transaction/TransactionCredenza';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
import { TokenBalance } from '@/lib/types';
import {
  cn,
  compactNumberFormat,
  formatNumber,
  isSoUSDEthereum,
  isSoUSDFuse,
  isUSDCEthereum,
} from '@/lib/utils';

const WalletTokenTab = () => {
  const insets = useSafeAreaInsets();
  const [width, setWidth] = useState(0);
  const { isScreenMedium } = useDimension();
  const router = useRouter();
  const { ethereumTokens, fuseTokens, baseTokens } = useWalletTokens();

  // Combine and sort tokens by USD value (descending)
  const allTokens = useMemo(() => {
    const combined = [...ethereumTokens, ...fuseTokens, ...baseTokens];
    return combined.sort((a, b) => {
      const balanceA = Number(formatUnits(BigInt(a.balance || '0'), a.contractDecimals));
      const balanceUSD_A = balanceA * (a.quoteRate || 0);

      const balanceB = Number(formatUnits(BigInt(b.balance || '0'), b.contractDecimals));
      const balanceUSD_B = balanceB * (b.quoteRate || 0);

      return balanceUSD_B - balanceUSD_A; // Descending order
    });
  }, [ethereumTokens, fuseTokens, baseTokens]);

  const format = isScreenMedium ? formatNumber : compactNumberFormat;

  const handleLayout = (e: LayoutChangeEvent) => {
    const { width } = e.nativeEvent.layout;
    setWidth(width);
  };

  const columnWidths = useMemo(() => {
    const COLUMN_WIDTHS = isScreenMedium ? [0.3, 0.3, 0.3, 0.1] : [0.25, 0, 0.25, 0.5];
    const offset = isScreenMedium ? 0 : 32;

    return COLUMN_WIDTHS.map(ratio => (width - offset) * ratio);
  }, [width, isScreenMedium]);

  const redirectToCoin = (token: TokenBalance) => {
    router.push(`/coins/${token.chainId}-${token.contractAddress}`);
  };

  // Use card-based design for mobile, table for desktop
  if (!isScreenMedium) {
    return (
      <View className="flex-1">
        <FlashList
          data={allTokens}
          estimatedItemSize={72}
          contentContainerStyle={{
            paddingBottom: insets.bottom,
          }}
          showsVerticalScrollIndicator={false}
          renderItem={({ item: token }) => {
            const balance = Number(
              formatUnits(BigInt(token.balance || '0'), token.contractDecimals),
            );
            const balanceUSD = balance * (token.quoteRate || 0);

            const tokenIcon = getTokenIcon({
              logoUrl: token.logoUrl,
              tokenSymbol: token.contractTickerSymbol,
              size: 40,
            });

            return (
              <Pressable
                className="flex-row items-center justify-between p-4 py-5 bg-[#1C1C1C] rounded-[20px] mb-2"
                onPress={() => redirectToCoin(token)}
              >
                <View className="flex-row items-center gap-3">
                  <RenderTokenIcon tokenIcon={tokenIcon} size={40} />
                  <View>
                    <Text className="font-bold text-lg">
                      {token.contractTickerSymbol || 'Unknown'}
                    </Text>
                    {isSoUSDEthereum(token.contractAddress) ? (
                      <View className="bg-accent rounded-full px-2 py-1 md:px-4 md:py-2 flex-row items-center gap-2 w-fit">
                        <Text className="text-xs font-semibold">Ready to withdraw</Text>
                      </View>
                    ) : null}
                  </View>
                </View>

                <View className="flex-row items-center gap-3">
                  <View className="items-end">
                    <Text className="font-bold text-base">{compactNumberFormat(balance)}</Text>
                    <Text className="text-sm font-medium text-muted-foreground">
                      ${compactNumberFormat(balanceUSD)}
                    </Text>
                  </View>
                </View>
              </Pressable>
            );
          }}
        />
      </View>
    );
  }

  // Desktop table implementation
  return (
    <View className="flex-1" onLayout={handleLayout}>
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
                className="h-0 md:h-full md:px-6 md:py-2"
                style={{ width: columnWidths[1] }}
              >
                <View className="flex-row items-center gap-1">
                  <Text className="hidden md:block text-sm">Balance</Text>
                  <TooltipPopover text="Balance without yield" />
                </View>
              </TableHead>
              <TableHead
                className="h-0 md:h-full md:px-6 md:py-2"
                style={{ width: columnWidths[2] }}
              >
                <Text className="hidden md:block text-sm">Price</Text>
              </TableHead>
              <TableHead
                className="h-0 md:h-full md:px-6 md:py-2"
                style={{ width: columnWidths[3] }}
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
                    onPress={() => redirectToCoin(token)}
                  >
                    <TableCell className="p-3 md:p-6" style={{ width: columnWidths[0] }}>
                      <View className="flex-row items-center gap-4">
                        <View className="flex-row items-center gap-2">
                          <RenderTokenIcon tokenIcon={tokenIcon} size={isScreenMedium ? 34 : 24} />
                          <View className="items-start">
                            <Text className="font-bold text-base">
                              {token.contractTickerSymbol || 'Unknown'}
                            </Text>
                          </View>
                        </View>
                        {isSoUSDEthereum(token.contractAddress) ? (
                          <View className="bg-accent rounded-full px-2 py-1 md:px-4 md:py-2 flex-row items-center gap-2 w-fit">
                            <Text className="text-sm font-semibold">Ready to withdraw</Text>
                          </View>
                        ) : null}
                      </View>
                    </TableCell>
                    <TableCell className="p-3 md:p-6" style={{ width: columnWidths[1] }}>
                      <View className="items-end md:items-start">
                        <Text className="font-bold text-base">
                          {format(balance)} {isScreenMedium ? token.contractTickerSymbol : ''}
                        </Text>
                        <Text className="text-sm text-muted-foreground">
                          ${format(balanceUSD, 2)}
                        </Text>
                      </View>
                    </TableCell>
                    <TableCell
                      className="hidden md:block md:p-6"
                      style={{ width: columnWidths[2] }}
                    >
                      <View className="items-start">
                        <Text className="font-bold text-base">
                          ${format(token.quoteRate || 0, 2)}
                        </Text>
                      </View>
                    </TableCell>
                    <TableCell className="p-3 pl-0 md:p-6" style={{ width: columnWidths[3] }}>
                      <View className="flex-row items-center justify-end">
                        <DropdownMenu>
                          <DropdownMenuTrigger>
                            <TransactionCredenzaTrigger />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent
                            align="end"
                            className="bg-card border-none rounded-xl p-1 min-w-[12rem]"
                          >
                            <View className="gap-2">
                              {!isSoUSDEthereum(token.contractAddress) && (
                                <SendModal token={token} />
                              )}
                              {isSoUSDFuse(token.contractAddress) ? (
                                <UnstakeModal />
                              ) : (
                                isSoUSDEthereum(token.contractAddress) && (
                                  <>
                                    <WithdrawModal />
                                    <StakeModal />
                                  </>
                                )
                              )}
                              {isUSDCEthereum(token.contractAddress) && <DepositModal />}
                            </View>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </View>
                    </TableCell>
                  </TableRow>
                );
              }}
            />
          </TableBody>
        </Table>
      </ScrollView>
    </View>
  );
};

export default WalletTokenTab;
