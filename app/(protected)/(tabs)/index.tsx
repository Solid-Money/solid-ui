import { useEffect } from 'react';
import { Platform, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useBlockNumber } from 'wagmi';
import { mainnet } from 'viem/chains';
import { Address } from 'viem';

import Navbar from '@/components/Navbar';
import NavbarMobile from '@/components/Navbar/NavbarMobile';
import { useDimension } from '@/hooks/useDimension';
import useUser from '@/hooks/useUser';
import { useFuseVaultBalance } from '@/hooks/useVault';
import { useLatestTokenTransfer, useTotalAPY } from '@/hooks/useAnalytics';
import { useDepositCalculations } from '@/hooks/useDepositCalculations';
import { useGetUserTransactionsQuery } from '@/graphql/generated/user-info';
import { ADDRESSES } from '@/lib/config';
import { FundWallet, StartEarning } from '@/components/Home';
import { DashboardHeader, DashboardHeaderMobile } from '@/components/Dashboard';

export default function Home() {
  const { user } = useUser();
  const { isScreenMedium } = useDimension();

  const { data: balance, refetch: refetchBalance } = useFuseVaultBalance(
    user?.safeAddress as Address,
  );

  const { data: blockNumber } = useBlockNumber({
    watch: true,
    chainId: mainnet.id,
  });

  const { data: totalAPY } = useTotalAPY();

  const { data: userDepositTransactions, refetch: refetchTransactions } =
    useGetUserTransactionsQuery({
      variables: {
        address: user?.safeAddress?.toLowerCase() ?? '',
      },
    });

  const { data: lastTimestamp } = useLatestTokenTransfer(
    user?.safeAddress ?? '',
    ADDRESSES.fuse.vault,
  );

  const { originalDepositAmount, firstDepositTimestamp } = useDepositCalculations(
    userDepositTransactions,
    balance,
    lastTimestamp,
  );

  useEffect(() => {
    refetchBalance();
    refetchTransactions();
  }, [blockNumber, refetchBalance, refetchTransactions]);

  return (
    <SafeAreaView
      className="bg-background text-foreground flex-1"
      edges={['right', 'left', 'bottom', 'top']}
    >
      <ScrollView className="flex-1">
        {Platform.OS !== 'web' && <NavbarMobile />}
        {Platform.OS === 'web' && <Navbar />}
        <View className="gap-12 md:gap-16 px-4 pt-4 pb-8 w-full max-w-7xl mx-auto">
          <>
            {isScreenMedium ? (
              <DashboardHeader
                balance={balance ?? 0}
                totalAPY={totalAPY ?? 0}
                firstDepositTimestamp={firstDepositTimestamp ?? 0}
                originalDepositAmount={originalDepositAmount}
                hasTokens={true}
              />
            ) : (
              <DashboardHeaderMobile
                balance={balance ?? 0}
                totalAPY={totalAPY ?? 0}
                lastTimestamp={lastTimestamp ?? 0}
                principal={originalDepositAmount}
              />
            )}
          </>

          <View className="md:flex-row justify-between gap-6">
            <FundWallet className="md:w-1/2 md:h-72" />
            <StartEarning className="md:w-1/2 md:h-72" />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
