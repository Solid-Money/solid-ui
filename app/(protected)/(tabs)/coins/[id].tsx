import { useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { ArrowUp } from 'lucide-react-native';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import Loading from '@/components/Loading';
import Navbar from '@/components/Navbar';
import { Text } from '@/components/ui/text';
import { useDimension } from '@/hooks/useDimension';
import { useWalletTokens } from '@/hooks/useWalletTokens';
import { TokenBalance } from '@/lib/types';
import { eclipseAddress } from '@/lib/utils';
import DashboardHeaderButtonsMobile from '@/components/Dashboard/DashboardHeaderButtonsMobile';
import CoinBackButton from '@/components/Coin/CoinBackButton';
import CoinChartTime from '@/components/Coin/CoinChartTime';

export default function Coin() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [chainId, contractAddress] = id.split('-');
  const { isScreenMedium } = useDimension();
  const { tokens, isLoading } = useWalletTokens();

  const token = useMemo(() => {
    return tokens.find(
      (token: TokenBalance) =>
        token.chainId === Number(chainId) && token.contractAddress === contractAddress,
    );
  }, [tokens, chainId, contractAddress]);

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

  return (
    <SafeAreaView
      className="bg-background text-foreground flex-1"
      edges={['right', 'left', 'bottom', 'top']}
    >
      <ScrollView className="flex-1">
        {isScreenMedium && <Navbar />}

        <View className="flex-1 gap-10 px-4 py-8 md:py-12 w-full max-w-lg mx-auto">
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

              <Text className="text-4xl md:text-5xl font-semibold">$3.56</Text>

              <View className="flex-row items-center">
                <Text className="text-sm text-brand font-medium">+0%</Text>
                <ArrowUp color="#94F27F" size={14} strokeWidth={3} />
              </View>
            </View>

            <CoinChartTime />

            <DashboardHeaderButtonsMobile />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
