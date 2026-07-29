import { useEffect, useMemo } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { ArrowDown, ArrowUp } from 'lucide-react-native';
import { zeroAddress } from 'viem';
import { useShallow } from 'zustand/react/shallow';

import ActivityTransactions from '@/components/Activity/ActivityTransactions';
import BalanceBreakdown from '@/components/Coin/BalanceBreakdown';
import CoinActionPills from '@/components/Coin/CoinActionPills';
import CoinBackButton from '@/components/Coin/CoinBackButton';
import CoinBalanceBreakdown from '@/components/Coin/CoinBalanceBreakdown';
import CoinChartTime from '@/components/Coin/CoinChartTime';
import CoinName from '@/components/Coin/CoinName';
import CoinSummary from '@/components/Coin/CoinSummary';
import EarningYield from '@/components/Coin/EarningYield';
import DashboardHeaderButtons from '@/components/Dashboard/DashboardHeaderButtons';
import DepositTrigger from '@/components/DepositOption/DepositTrigger';
import LazyAreaChart from '@/components/LazyAreaChart';
import PageLayout from '@/components/PageLayout';
import { Text } from '@/components/ui/text';
import { times } from '@/constants/coins';
import { DEPOSIT_MODAL } from '@/constants/modals';
import { NATIVE_COINGECKO_TOKENS } from '@/constants/tokens';
import { useCoinHistoricalChart } from '@/hooks/useAnalytics';
import { useCoinBreakdown } from '@/hooks/useCoinBreakdown';
import { useDimension } from '@/hooks/useDimension';
import { useWalletTokens } from '@/hooks/useWalletTokens';
import { TokenBalance, TokenType } from '@/lib/types';
import { eclipseAddress, formatNumber } from '@/lib/utils';
import { getTokenVault } from '@/lib/vaults';
import { useCoinStore } from '@/store/useCoinStore';
import { useDepositStore } from '@/store/useDepositStore';

const MAX_SAMPLE_SIZE = 20;

const ResponsiveBalanceBreakdown = ({ token }: { token: TokenBalance | undefined }) => {
  const { isScreenMedium } = useDimension();

  return (
    <View style={{ flex: isScreenMedium ? 0.3 : 1 }} className="relative md:min-w-[406px]">
      <BalanceBreakdown token={token} className="z-10" />
      <EarningYield token={token} className="-mt-4 ml-[1%] w-[98%] rounded-t-none" />
    </View>
  );
};

function normalizeCoinAddress(contractAddress: string): string {
  const lower = contractAddress?.toLowerCase() ?? '';
  if (!lower || lower === 'native' || lower === '0x0') return zeroAddress;
  if (lower === zeroAddress.toLowerCase()) return zeroAddress;
  return contractAddress;
}

export default function Coin() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [chainId, rawContractAddress] = id.split('-');
  const contractAddress = useMemo(
    () => normalizeCoinAddress(rawContractAddress ?? ''),
    [rawContractAddress],
  );
  const { tokens, isLoading } = useWalletTokens();
  const { selectedTime, selectedPrice, selectedPriceChange } = useCoinStore(
    useShallow(state => ({
      selectedTime: state.selectedTime,
      selectedPrice: state.selectedPrice,
      selectedPriceChange: state.selectedPriceChange,
    })),
  );
  const { isScreenMedium } = useDimension();
  const isPriceIncrease = selectedPriceChange != null && selectedPriceChange >= 0;

  const time = useMemo(() => {
    return times.find(time => time.value === selectedTime);
  }, [selectedTime]);

  const token = useMemo(() => {
    return tokens.find(
      (t: TokenBalance) =>
        t.chainId === Number(chainId) &&
        (t.contractAddress?.toLowerCase() ?? '') === (contractAddress?.toLowerCase() ?? ''),
    );
  }, [tokens, chainId, contractAddress]);

  const chartCoinId = useMemo(
    () =>
      token?.tokenId ??
      (token?.type === TokenType.NATIVE && token?.chainId != null
        ? NATIVE_COINGECKO_TOKENS[token.chainId]
        : undefined),
    [token?.tokenId, token?.type, token?.chainId],
  );
  const chartQuery =
    token?.contractTickerSymbol || token?.contractName || token?.contractAddress || '';

  // The price chart is desktop-only, so skip the request entirely on mobile.
  const { data: coinHistoricalChart, isLoading: isLoadingCoinHistoricalChart } =
    useCoinHistoricalChart(
      isScreenMedium ? chartCoinId : undefined,
      isScreenMedium ? chartQuery : '',
      time?.value,
    );

  const tokenVault = useMemo(() => getTokenVault(token), [token]);
  const breakdown = useCoinBreakdown(token);

  const setSelectedPrice = useCoinStore(state => state.setSelectedPrice);
  const setSelectedPriceChange = useCoinStore(state => state.setSelectedPriceChange);

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

  useEffect(() => {
    setSelectedPrice(null);
    setSelectedPriceChange(null);
  }, [id, setSelectedPrice, setSelectedPriceChange]);

  useEffect(() => {
    if (formattedChartData.length > 0 && selectedPrice == null && !isLoadingCoinHistoricalChart) {
      const last = formattedChartData[formattedChartData.length - 1];
      setSelectedPrice(last.value);
      if (formattedChartData.length >= 2) {
        const prev = formattedChartData[formattedChartData.length - 2];
        const change = prev.value === 0 ? null : ((last.value - prev.value) / prev.value) * 100;
        setSelectedPriceChange(change ?? null);
      }
    }
  }, [
    formattedChartData,
    selectedPrice,
    isLoadingCoinHistoricalChart,
    setSelectedPrice,
    setSelectedPriceChange,
  ]);

  const desktopHeaderContent = useMemo(
    () => (
      <View className="gap-12 py-8 md:py-12">
        <View className="flex-row items-center justify-between gap-2">
          <View className="flex-row items-center gap-5">
            <CoinBackButton tokenSymbol={token?.contractTickerSymbol} />
            <CoinName
              contractName={token?.contractName || ''}
              contractTickerSymbol={token?.contractTickerSymbol || ''}
            />
          </View>
          <View className="flex-row gap-2">
            <DashboardHeaderButtons deposit={{ title: 'Add funds' }} hideWithdraw hideDeposit />
            <DepositTrigger
              buttonText="Deposit To Savings"
              modal={DEPOSIT_MODAL.OPEN_FORM}
              source="coin_header"
              onBeforeOpen={() => {
                useDepositStore.getState().setDepositFromSolid(true);
              }}
            />
          </View>
        </View>

        <View className="justify-between gap-6 md:flex-row md:gap-10">
          <View style={{ flex: 0.7 }}>
            <View className="flex-row items-center justify-between">
              <View className="flex-1 gap-2">
                <Text className="text-4xl font-semibold md:text-5xl">
                  {selectedPrice
                    ? `$${formatNumber(selectedPrice)}`
                    : formattedChartData.length > 0
                      ? `$${formatNumber(formattedChartData[formattedChartData.length - 1].value)}`
                      : '$0.00'}
                </Text>

                <View className="flex-row items-center gap-1">
                  <Text
                    className="text-sm font-medium"
                    style={{ color: isPriceIncrease ? '#94F27F' : '#EF4444' }}
                  >
                    {selectedPriceChange != null
                      ? `${isPriceIncrease ? '+' : '-'}${formatNumber(Math.abs(selectedPriceChange), 2)}%`
                      : '0.00%'}
                  </Text>
                  {isPriceIncrease ? (
                    <ArrowUp color="#94F27F" size={14} strokeWidth={3} />
                  ) : (
                    <ArrowDown color="#EF4444" size={14} strokeWidth={3} />
                  )}
                </View>
              </View>
              <CoinChartTime />
            </View>

            <View className="-mt-2 px-4 md:mt-0">
              {isLoadingCoinHistoricalChart ? (
                <View className="h-[200px] items-center justify-center">
                  <ActivityIndicator size="large" color="white" />
                </View>
              ) : formattedChartData.length > 0 ? (
                <View style={{ marginLeft: -16, marginRight: -16 }}>
                  <LazyAreaChart
                    data={formattedChartData}
                    isYAxisLabel={false}
                    formatYAxis={value => {
                      if (value === 0) return '$0';
                      const abs = Math.abs(value);
                      if (abs >= 1) return `$${formatNumber(value, 1, 0)}`;
                      const maxDigits = Math.min(8, Math.max(2, Math.ceil(-Math.log10(abs)) + 2));
                      return `$${formatNumber(value, maxDigits, 0)}`;
                    }}
                  />
                </View>
              ) : null}
            </View>
          </View>
          <ResponsiveBalanceBreakdown token={token} />
        </View>

        {token?.contractTickerSymbol && (
          <View className="pt-12">
            <Text className="text-lg font-semibold text-muted-foreground">Recent activity</Text>
          </View>
        )}
      </View>
    ),
    [
      token,
      selectedPrice,
      selectedPriceChange,
      isPriceIncrease,
      formattedChartData,
      isLoadingCoinHistoricalChart,
    ],
  );

  const mobileHeaderContent = useMemo(
    () => (
      <View className="gap-8 py-6">
        <CoinSummary token={token} breakdown={breakdown} tokenVault={tokenVault} />

        <CoinActionPills tokenVault={tokenVault} />

        <CoinBalanceBreakdown breakdown={breakdown} />

        {token?.contractTickerSymbol && (
          <Text className="text-base font-semibold text-muted-foreground">Recent activity</Text>
        )}
      </View>
    ),
    [token, breakdown, tokenVault],
  );

  return (
    <PageLayout desktopOnly isLoading={isLoading} scrollable={false}>
      {!token && !isLoading ? (
        <View className="mx-auto w-full max-w-7xl gap-8 px-4 py-8 md:gap-16 md:py-12">
          <CoinBackButton title={`Coin ${eclipseAddress(contractAddress)} not found`} />
        </View>
      ) : (
        <View className="mx-auto w-full max-w-7xl flex-1 px-4">
          <ActivityTransactions
            symbol={token?.contractTickerSymbol}
            showTimestamp={false}
            listHeaderComponent={isScreenMedium ? desktopHeaderContent : mobileHeaderContent}
          />
        </View>
      )}
    </PageLayout>
  );
}
