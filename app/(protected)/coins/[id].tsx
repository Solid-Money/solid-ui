import { useMemo } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { zeroAddress } from 'viem';

import ActivityTransactions from '@/components/Activity/ActivityTransactions';
import CoinActionPills from '@/components/Coin/CoinActionPills';
import CoinBackButton from '@/components/Coin/CoinBackButton';
import CoinBalanceBreakdown from '@/components/Coin/CoinBalanceBreakdown';
import CoinSummary from '@/components/Coin/CoinSummary';
import PageLayout from '@/components/PageLayout';
import { Text } from '@/components/ui/text';
import { useCoinBreakdown } from '@/hooks/useCoinBreakdown';
import { useWalletTokens } from '@/hooks/useWalletTokens';
import { TokenBalance } from '@/lib/types';
import { eclipseAddress } from '@/lib/utils';
import { getTokenVault } from '@/lib/vaults';

function normalizeCoinAddress(contractAddress: string): string {
  const lower = contractAddress?.toLowerCase() ?? '';
  if (!lower || lower === 'native' || lower === '0x0') return zeroAddress;
  if (lower === zeroAddress.toLowerCase()) return zeroAddress;
  return contractAddress;
}

/**
 * Token detail screen. One layout at every width — desktop is the redesigned
 * screen, stretched inside the sidebar shell.
 *
 * The redesign has no price chart, so the CoinGecko history request, the
 * selected-price store state and the chart-only header (time selector, area chart,
 * balance-breakdown column) are all gone with the desktop layout that used them.
 * `CoinSummary` carries the back button, which is why no navbar is rendered here.
 */
export default function Coin() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [chainId, rawContractAddress] = id.split('-');
  const contractAddress = useMemo(
    () => normalizeCoinAddress(rawContractAddress ?? ''),
    [rawContractAddress],
  );
  const { tokens, isLoading } = useWalletTokens();

  const token = useMemo(() => {
    return tokens.find(
      (t: TokenBalance) =>
        t.chainId === Number(chainId) &&
        (t.contractAddress?.toLowerCase() ?? '') === (contractAddress?.toLowerCase() ?? ''),
    );
  }, [tokens, chainId, contractAddress]);

  const tokenVault = useMemo(() => getTokenVault(token), [token]);
  const breakdown = useCoinBreakdown(token);

  const headerContent = useMemo(
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
            listHeaderComponent={headerContent}
          />
        </View>
      )}
    </PageLayout>
  );
}
