import { useLocalSearchParams } from 'expo-router';
import { ArrowDown, ArrowUp } from 'lucide-react-native';
import { useMemo } from 'react';
import { ActivityIndicator, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { formatUnits } from 'viem';

import AreaChart from '@/components/AreaChart.web';
import CoinBackButton from '@/components/Coin/CoinBackButton';
import CoinChartTime from '@/components/Coin/CoinChartTime';
import DashboardHeaderButtonsMobile from '@/components/Dashboard/DashboardHeaderButtonsMobile';
import Loading from '@/components/Loading';
import Navbar from '@/components/Navbar';
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
  const { isScreenMedium } = useDimension();
  const { tokens, isLoading } = useWalletTokens();
  const { selectedTime, selectedPrice, selectedPriceChange } = useCoinStore();

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

  if (isLoading) return <Loading />;

  if (!token)
    return (
      <SafeAreaView className="bg-background text-foreground flex-1">
        <ScrollView className="flex-1">
          {isScreenMedium && <Navbar />}
          <View className="gap-8 md:gap-16 px-4 py-8 md:py-12 w-full max-w-lg mx-auto">
            <CoinBackButton title={`Coin ${eclipseAddress(contractAddress)} not found`} />
          </View>
        </ScrollView>
      </SafeAreaView>
    );

  const balance = Number(formatUnits(BigInt(token.balance || '0'), token.contractDecimals));
  const balanceUSD = balance * (token.quoteRate || 0);

  return (
    <SafeAreaView
      className="bg-background text-foreground flex-1"
      edges={['right', 'left', 'bottom', 'top']}
    >
      <ScrollView className="flex-1">
        {isScreenMedium && <Navbar />}

        <View className="flex-1 gap-12 px-4 py-8 md:py-12 w-full max-w-lg mx-auto">
          <View className="gap-6">
            <CoinBackButton
              tokenSymbol={token.contractTickerSymbol}
              className="text-xl md:text-3xl"
            />

            <View className="gap-2">
              <View className="flex-row items-center gap-2">
                <Text className="text-xl md:text-3xl font-bold">{token.contractName}</Text>
                <Text className="text-xl md:text-3xl font-medium text-muted-foreground">
                  {token.contractTickerSymbol}
                </Text>
              </View>

              <Text className="text-4xl md:text-5xl font-semibold">
                {selectedPrice
                  ? `$${formatNumber(selectedPrice)}`
                  : formattedChartData.length > 0
                    ? `$${formatNumber(formattedChartData[formattedChartData.length - 1].value)}`
                    : '$0.00'}
              </Text>

              <View className="flex-row items-center">
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

            {isLoadingCoinHistoricalChart ? (
              <View className="h-[200px] items-center justify-center">
                <ActivityIndicator size="large" color="white" />
              </View>
            ) : formattedChartData.length > 0 ? (
              <AreaChart data={formattedChartData} />
            ) : null}

            <CoinChartTime />
          </View>

          <DashboardHeaderButtonsMobile />

          <View className="bg-card rounded-twice p-5 flex-row items-center justify-between">
            <Text className="text-lg font-bold">Balance</Text>
            <View className="items-end">
              <Text className="text-xl font-bold">
                {formatNumber(balance)} {token.contractTickerSymbol}
              </Text>
              <Text className="text-sm text-muted-foreground font-bold">
                ${formatNumber(balanceUSD)}
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
