import { useLocalSearchParams } from 'expo-router';
import { ArrowDown, ArrowUp } from 'lucide-react-native';
import { useMemo } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Address, formatUnits } from 'viem';

import ActivityTransactions from '@/components/Activity/ActivityTransactions';
import AreaChart from '@/components/AreaChart';
import BalanceBreakdown from '@/components/Coin/BalanceBreakdown';
import CoinBackButton from '@/components/Coin/CoinBackButton';
import CoinButtons from '@/components/Coin/CoinButtons';
import CoinChartTime from '@/components/Coin/CoinChartTime';
import CoinName from '@/components/Coin/CoinName';
import EarningYield from '@/components/Coin/EarningYield';
import DashboardHeaderButtons from '@/components/Dashboard/DashboardHeaderButtons';
import PageLayout from '@/components/PageLayout';
import { Text } from '@/components/ui/text';
import { times } from '@/constants/coins';
import { useSearchCoinHistoricalChart } from '@/hooks/useAnalytics';
import { useDimension } from '@/hooks/useDimension';
import { useWalletTokens } from '@/hooks/useWalletTokens';
import { TokenBalance } from '@/lib/types';
import { cn, eclipseAddress, formatNumber } from '@/lib/utils';
import { useCoinStore } from '@/store/useCoinStore';

const MAX_SAMPLE_SIZE = 20;

export default function Coin() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [chainId, contractAddress] = id.split('-');
  const { tokens, isLoading } = useWalletTokens();
  const { selectedTime, selectedPrice, selectedPriceChange } = useCoinStore();
  const { isScreenMedium } = useDimension();
  const isPriceIncrease = selectedPriceChange && selectedPriceChange >= 0;

  const time = useMemo(() => {
    return times.find(time => time.value === selectedTime);
  }, [selectedTime]);

  const token = useMemo(() => {
    return tokens.find(
      (token: TokenBalance) =>
        token.chainId === Number(chainId) && token.contractAddress === contractAddress,
    );
  }, [tokens, chainId, contractAddress]);

  const { data: coinHistoricalChart, isLoading: isLoadingCoinHistoricalChart } =
    useSearchCoinHistoricalChart(
      token?.contractTickerSymbol || token?.contractName || token?.contractAddress || '',
      time?.value,
    );

  const formattedChartData = useMemo(() => {
    if (!coinHistoricalChart?.prices) return [];

    const prices = coinHistoricalChart.prices;

    const sampled =
      prices.length > MAX_SAMPLE_SIZE
        ? Array.from({ length: MAX_SAMPLE_SIZE }, (_, i) => {
            const index = Math.round((i * (prices.length - 1)) / (MAX_SAMPLE_SIZE - 1));
            return prices[index];
          })
        : prices;

    return sampled.map(([timestamp, price]) => ({
      time: timestamp,
      value: price,
    }));
  }, [coinHistoricalChart]);

  const balance = token
    ? Number(formatUnits(BigInt(token.balance || '0'), token.contractDecimals))
    : 0;
  const balanceUSD = token ? balance * (token.quoteRate || 0) : 0;

  return (
    <PageLayout desktopOnly isLoading={isLoading}>
      {!token && !isLoading ? (
        <View className="gap-8 md:gap-16 px-4 py-8 md:py-12 w-full max-w-7xl mx-auto">
          <CoinBackButton title={`Coin ${eclipseAddress(contractAddress)} not found`} />
        </View>
      ) : (
        <View className="flex-1 gap-12 px-4 py-8 md:py-12 w-full max-w-7xl mx-auto">
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center gap-5">
              <CoinBackButton tokenSymbol={token?.contractTickerSymbol} />
              {isScreenMedium && (
                <CoinName
                  contractName={token?.contractName || ''}
                  contractTickerSymbol={token?.contractTickerSymbol || ''}
                />
              )}
            </View>
            {isScreenMedium && <DashboardHeaderButtons />}
          </View>

          <View className="flex-row justify-between gap-10">
            <View style={{ flex: 0.7 }}>
              <View className="flex-row items-center justify-between">
                <View className="flex-1 gap-2">
                  {!isScreenMedium && (
                    <CoinName
                      contractName={token?.contractName || ''}
                      contractTickerSymbol={token?.contractTickerSymbol || ''}
                    />
                  )}

                  <Text className="text-4xl md:text-5xl font-semibold">
                    {selectedPrice
                      ? `$${formatNumber(selectedPrice)}`
                      : formattedChartData.length > 0
                        ? `$${formatNumber(formattedChartData[formattedChartData.length - 1].value)}`
                        : '$0.00'}
                  </Text>

                  <View className="flex-row items-center gap-1">
                    <Text
                      className={cn(
                        'text-sm font-medium',
                        isPriceIncrease ? 'text-brand' : 'text-red-500',
                      )}
                    >
                      {isPriceIncrease ? '+' : '-'}
                      {selectedPriceChange
                        ? `$${formatNumber(Math.abs(selectedPriceChange), 2)}%`
                        : '0.00%'}
                    </Text>
                    {isPriceIncrease ? (
                      <ArrowUp color="#94F27F" size={14} strokeWidth={3} />
                    ) : (
                      <ArrowDown color="#EF4444" size={14} strokeWidth={3} />
                    )}
                  </View>
                </View>
                {isScreenMedium && <CoinChartTime />}
              </View>

              <View className="md:px-4">
                {isLoadingCoinHistoricalChart ? (
                  <View className="h-[200px] items-center justify-center">
                    <ActivityIndicator size="large" color="white" />
                  </View>
                ) : formattedChartData.length > 0 ? (
                  <View style={{ marginLeft: -16, marginRight: -16 }}>
                    <AreaChart data={formattedChartData} />
                  </View>
                ) : null}
              </View>
            </View>
            <View style={{ flex: 0.3 }} className="relative">
              <BalanceBreakdown token={token} className="z-10" />
              <EarningYield token={token} className="rounded-t-none -mt-4 pt-1" />
            </View>
          </View>

          {!isScreenMedium && <CoinChartTime />}

          {!isScreenMedium && <CoinButtons contractAddress={contractAddress as Address} />}

          {!isScreenMedium && (
            <View className="bg-card rounded-twice p-5 flex-row items-center justify-between">
              <Text className="text-lg font-bold">Balance</Text>
              <View className="items-end">
                <Text className="text-xl font-bold">
                  {formatNumber(balance)} {token?.contractTickerSymbol}
                </Text>
                <Text className="text-sm text-muted-foreground font-bold">
                  ${formatNumber(balanceUSD)}
                </Text>
              </View>
            </View>
          )}

          {token?.contractTickerSymbol && (
            <View className="gap-4">
              <Text className="text-lg text-muted-foreground font-semibold">Recent activity</Text>
              <ActivityTransactions symbol={token.contractTickerSymbol} showTimestamp={false} />
            </View>
          )}
        </View>
      )}
    </PageLayout>
  );
}
