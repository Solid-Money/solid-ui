import { useEffect } from 'react';
import { Platform, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useBlockNumber } from 'wagmi';
import { mainnet } from 'viem/chains';
import { Address } from 'viem';

import Navbar from '@/components/Navbar';
import NavbarMobile from '@/components/Navbar/NavbarMobile';
import { fontSize } from '@/lib/utils';
import { useDimension } from '@/hooks/useDimension';
import useUser from '@/hooks/useUser';
import { useFuseVaultBalance } from '@/hooks/useVault';
import { useLatestTokenTransfer, useTotalAPY } from '@/hooks/useAnalytics';
import SavingCountUp from '@/components/SavingCountUp';
import { useDepositCalculations } from '@/hooks/useDepositCalculations';
import { useGetUserTransactionsQuery } from '@/graphql/generated/user-info';
import { ADDRESSES } from '@/lib/config';
import { FundWallet, HomeButtons, HomeButtonsMobile, StartEarning } from '@/components/Home';

export default function Home() {
  const { user } = useUser();
  const { isScreenMedium } = useDimension();

  const {
    data: balance,
    refetch: refetchBalance,
  } = useFuseVaultBalance(user?.safeAddress as Address);

  const { data: blockNumber } = useBlockNumber({
    watch: true,
    chainId: mainnet.id,
  });

  const { data: totalAPY } = useTotalAPY();

  const {
    data: userDepositTransactions,
    refetch: refetchTransactions,
  } = useGetUserTransactionsQuery({
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
  }, [
    blockNumber,
    refetchBalance,
    refetchTransactions,
  ]);

  return (
    <SafeAreaView
      className="bg-background text-foreground flex-1"
      edges={['right', 'left', 'bottom', 'top']}
    >
      <ScrollView className="flex-1">
        {Platform.OS !== 'web' && <NavbarMobile />}
        {Platform.OS === 'web' && <Navbar />}
        <View className="gap-12 md:gap-16 px-4 pt-4 pb-8 w-full max-w-7xl mx-auto">
          <View className="md:flex-row items-center justify-between gap-y-4">
            <SavingCountUp
              balance={balance ?? 0}
              apy={totalAPY ?? 0}
              lastTimestamp={firstDepositTimestamp ?? 0}
              principal={originalDepositAmount}
              classNames={{
                wrapper: 'text-foreground',
                decimalSeparator: 'text-2xl md:text-4.5xl font-medium',
              }}
              styles={{
                wholeText: {
                  fontSize: isScreenMedium ? fontSize(6) : fontSize(3),
                  fontWeight: isScreenMedium ? 'medium' : 'semibold',
                  color: '#ffffff',
                  marginRight: -2,
                },
                decimalText: {
                  fontSize: isScreenMedium ? fontSize(2.5) : fontSize(1.5),
                  fontWeight: isScreenMedium ? 'medium' : 'semibold',
                  color: '#ffffff',
                },
              }}
            />
            {isScreenMedium ? <HomeButtons /> : <HomeButtonsMobile />}
          </View>

          <View className="md:flex-row justify-between gap-6">
            <FundWallet className="md:w-1/2 md:h-72" />
            <StartEarning className="md:w-1/2 md:h-72" />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
