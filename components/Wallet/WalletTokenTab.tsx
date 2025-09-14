import { FlashList } from '@shopify/flash-list';
import { useEffect, useMemo, useState } from 'react';
import { LayoutChangeEvent, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Address, formatUnits } from 'viem';
import { mainnet } from 'viem/chains';
import { useBlockNumber } from 'wagmi';

import DepositModal from '@/components/Deposit/DepositModal';
import Ping from '@/components/Ping';
import RenderTokenIcon from '@/components/RenderTokenIcon';
import SavingCountUp from '@/components/SavingCountUp';
import SendModal from '@/components/SendModal/SendModal';
import StakeModal from '@/components/Stake/StakeModal';
import { TransactionCredenzaTrigger } from '@/components/Transaction/TransactionCredenza';
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
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
import { useGetUserTransactionsQuery } from '@/graphql/generated/user-info';
import { useLatestTokenTransfer, useTotalAPY } from '@/hooks/useAnalytics';
import { useDepositCalculations } from '@/hooks/useDepositCalculations';
import { useDimension } from '@/hooks/useDimension';
import useUser from '@/hooks/useUser';
import { useFuseVaultBalance } from '@/hooks/useVault';
import { useWalletTokens } from '@/hooks/useWalletTokens';
import { ADDRESSES } from '@/lib/config';
import getTokenIcon from '@/lib/getTokenIcon';
import { SavingMode } from '@/lib/types';
import {
  cn,
  compactNumberFormat,
  fontSize,
  formatNumber,
  isSoUSDEthereum,
  isSoUSDFuse,
  isUSDCEthereum,
} from '@/lib/utils';

const WalletTokenTab = () => {
  const insets = useSafeAreaInsets();
  const [width, setWidth] = useState(0);
  const { isScreenMedium } = useDimension();
  const { user } = useUser();
  const { data: totalAPY } = useTotalAPY();

  const { data: blockNumber } = useBlockNumber({
    watch: true,
    chainId: mainnet.id,
  });
  const { data: userDepositTransactions, refetch: refetchTransactions } =
    useGetUserTransactionsQuery({
      variables: {
        address: user?.safeAddress?.toLowerCase() ?? '',
      },
    });
  const { data: balance, refetch: refetchBalance } = useFuseVaultBalance(
    user?.safeAddress as Address,
  );
  const { data: lastTimestamp } = useLatestTokenTransfer(
    user?.safeAddress ?? '',
    ADDRESSES.fuse.vault,
  );
  const { firstDepositTimestamp } = useDepositCalculations(
    userDepositTransactions,
    balance,
    lastTimestamp,
  );

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
    const COLUMN_WIDTHS = isScreenMedium ? [0.15, 0.15, 0.2, 0.2, 0.3] : [0.25, 0, 0.25, 0, 0.5];
    const offset = isScreenMedium ? 0 : 32;

    return COLUMN_WIDTHS.map(ratio => (width - offset) * ratio);
  }, [width, isScreenMedium]);

  useEffect(() => {
    refetchBalance();
    refetchTransactions();
  }, [blockNumber, refetchBalance, refetchTransactions]);

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
              <View className="flex-row items-center justify-between p-4 py-5 bg-[#1C1C1C] rounded-[20px] mb-2">
                <View className="flex-row items-center gap-3">
                  <RenderTokenIcon tokenIcon={tokenIcon} size={40} />
                  <View>
                    <Text className="font-bold text-lg">
                      {token.contractTickerSymbol || 'Unknown'}
                    </Text>
                  </View>
                </View>

                <View className="flex-row items-center gap-3">
                  {isSoUSDFuse(token.contractAddress) ? (
                    <View>
                      <SavingCountUp
                        balance={balance ?? 0}
                        apy={totalAPY ?? 0}
                        lastTimestamp={firstDepositTimestamp ?? 0}
                        mode={SavingMode.TOTAL}
                        styles={{
                          wholeText: {
                            fontSize: fontSize(1),
                            fontWeight: 'bold',
                            fontFamily: 'MonaSans_700Bold',
                            color: '#ffffff',
                          },
                          decimalText: {
                            fontSize: fontSize(1),
                            fontWeight: 'bold',
                            fontFamily: 'MonaSans_700Bold',
                            color: '#ffffff',
                          },
                        }}
                      />
                      <View className="flex-row items-center">
                        <Text className="text-sm text-muted-foreground">$</Text>
                        <SavingCountUp
                          balance={balance ?? 0}
                          apy={totalAPY ?? 0}
                          lastTimestamp={firstDepositTimestamp ?? 0}
                          decimalPlaces={2}
                          classNames={{
                            wrapper: 'text-muted-foreground',
                            decimalSeparator: 'text-sm text-muted-foreground',
                          }}
                          styles={{
                            wholeText: {
                              fontSize: fontSize(0.875),
                              fontWeight: 'normal',
                              fontFamily: 'MonaSans_400Regular',
                              color: '#A1A1A1',
                            },
                            decimalText: {
                              fontSize: fontSize(0.875),
                              fontWeight: 'normal',
                              fontFamily: 'MonaSans_400Regular',
                              color: '#A1A1A1',
                            },
                          }}
                        />
                      </View>
                    </View>
                  ) : (
                    <View>
                      <Text className="font-bold">{compactNumberFormat(balance)}</Text>
                      <Text className="text-sm font-medium text-muted-foreground">
                        ${compactNumberFormat(balanceUSD)}
                      </Text>
                    </View>
                  )}
                  <DropdownMenu>
                    <DropdownMenuTrigger>
                      <TransactionCredenzaTrigger />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="bg-card border-none rounded-xl p-1 min-w-[10rem]">
                      <View className="gap-2">
                        {!isSoUSDEthereum(token.contractAddress) && (
                          <SendModal
                            tokenAddress={token.contractAddress as Address}
                            tokenDecimals={token.contractDecimals}
                            tokenIcon={tokenIcon}
                            tokenSymbol={token.contractTickerSymbol || 'Unknown'}
                            chainId={token.chainId}
                        tokenType={token.type}
                          />
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
              </View>
            );
          }}
        />
      </View>
    );
  }

  // Desktop table implementation
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
                      {isSoUSDFuse(token.contractAddress) ? (
                        <View>
                          <View className="flex-row items-center gap-1">
                            <SavingCountUp
                              balance={balance ?? 0}
                              apy={totalAPY ?? 0}
                              lastTimestamp={firstDepositTimestamp ?? 0}
                              mode={SavingMode.TOTAL}
                              suffix={token.contractTickerSymbol}
                              styles={{
                                wholeText: {
                                  fontSize: fontSize(1),
                                  fontWeight: 'bold',
                                  fontFamily: 'MonaSans_700Bold',
                                  color: '#ffffff',
                                },
                                decimalText: {
                                  fontSize: fontSize(1),
                                  fontWeight: 'bold',
                                  fontFamily: 'MonaSans_700Bold',
                                  color: '#ffffff',
                                },
                              }}
                            />
                            
                          </View>
                          <View className="flex-row items-center">
                            <Text className="text-sm text-muted-foreground">$</Text>
                            <SavingCountUp
                              balance={balance ?? 0}
                              apy={totalAPY ?? 0}
                              lastTimestamp={firstDepositTimestamp ?? 0}
                              classNames={{
                                wrapper: 'text-muted-foreground',
                                decimalSeparator: 'text-sm text-muted-foreground',
                              }}
                              styles={{
                                wholeText: {
                                  fontSize: fontSize(0.875),
                                  fontWeight: 'normal',
                                  fontFamily: 'MonaSans_400Regular',
                                  color: '#A1A1A1',
                                },
                                decimalText: {
                                  fontSize: fontSize(0.875),
                                  fontWeight: 'normal',
                                  fontFamily: 'MonaSans_400Regular',
                                  color: '#A1A1A1',
                                },
                              }}
                            />
                          </View>
                        </View>
                      ) : (
                        <View className="items-end md:items-start">
                          <Text className="font-bold">
                            {format(balance)} {isScreenMedium ? token.contractTickerSymbol : ''}
                          </Text>
                          <Text className="text-sm text-muted-foreground">
                            ${format(balanceUSD)}
                          </Text>
                        </View>
                      )}
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
                      <View className="flex-row items-center justify-end">
                        <DropdownMenu>
                          <DropdownMenuTrigger>
                            <TransactionCredenzaTrigger />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="bg-card border-none rounded-xl p-1 min-w-[12rem]">
                            <View className="gap-2">
                              {!isSoUSDEthereum(token.contractAddress) && (
                                <SendModal
                                  tokenAddress={token.contractAddress as Address}
                                  tokenDecimals={token.contractDecimals}
                                  tokenIcon={tokenIcon}
                                  tokenSymbol={token.contractTickerSymbol || 'Unknown'}
                                  chainId={token.chainId}
                            tokenType={token.type}
                                />
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
    </>
  );
};

export default WalletTokenTab;
