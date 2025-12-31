import { DashboardTitle } from '@/components/Dashboard';
import { HomeBanners } from '@/components/Dashboard/HomeBanners';
import { FAQs } from '@/components/FAQ';
import PageLayout from '@/components/PageLayout';
import Ping from '@/components/Ping';
import SavingCountUp from '@/components/SavingCountUp';
import SavingsEmptyState from '@/components/Savings/EmptyState';
import SavingsHeaderButtons from '@/components/Savings/SavingsHeaderButtons';
import SavingsHeaderButtonsMobile from '@/components/Savings/SavingsHeaderButtonsMobile';
import TooltipPopover from '@/components/Tooltip';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import faqs from '@/constants/faqs';
import {
  useAPYs,
  useLatestTokenTransfer,
  useMaxAPY,
  useUserTransactions,
} from '@/hooks/useAnalytics';
import { useDepositCalculations } from '@/hooks/useDepositCalculations';
import { useDimension } from '@/hooks/useDimension';
import useUser from '@/hooks/useUser';
import { useVaultBalance } from '@/hooks/useVault';
import { useWalletTokens } from '@/hooks/useWalletTokens';
import { ADDRESSES } from '@/lib/config';
import { SavingMode } from '@/lib/types';
import { fontSize, formatNumber } from '@/lib/utils';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect } from 'react';
import { FlatList, ImageBackground, Platform, View } from 'react-native';
import { Address } from 'viem';

export default function Savings() {
  const { user } = useUser();
  const { isScreenMedium } = useDimension();
  const {
    data: balance,
    isLoading: isBalanceLoading,
    refetch: refetchBalance,
  } = useVaultBalance(user?.safeAddress as Address);
  const { maxAPY, maxAPYDays, isAPYsLoading: isMaxAPYsLoading } = useMaxAPY();
  const { data: apys, isLoading: isAPYsLoading } = useAPYs();

  const { hasTokens } = useWalletTokens();
  const { data: lastTimestamp } = useLatestTokenTransfer(
    user?.safeAddress ?? '',
    ADDRESSES.fuse.vault,
  );

  const {
    data: userDepositTransactions,
    isLoading: isTransactionsLoading,
    refetch: refetchTransactions,
  } = useUserTransactions(user?.safeAddress);

  const { firstDepositTimestamp } = useDepositCalculations(
    userDepositTransactions,
    balance,
    lastTimestamp,
  );

  // Controlled polling for balance/transaction updates - every 60 seconds instead of every block (~12s)
  useEffect(() => {
    const interval = setInterval(() => {
      refetchBalance();
      refetchTransactions();
    }, 60000); // 60 seconds
    return () => clearInterval(interval);
  }, [refetchBalance, refetchTransactions]);

  const isLoading = isBalanceLoading || isTransactionsLoading;

  if (!balance && !userDepositTransactions?.deposits?.length && !isLoading) {
    return <SavingsEmptyState />;
  }

  const renderContent = () => (
    <>
      <View className="gap-8 md:gap-9 px-4 py-8 pt-8 md:py-10 w-full max-w-7xl mx-auto">
        {isScreenMedium ? (
          <View className="flex-row justify-between items-center">
            <DashboardTitle />
            <SavingsHeaderButtons hasTokens={hasTokens} />
          </View>
        ) : (
          <Text className="text-xl font-semibold">Savings</Text>
        )}
        <LinearGradient
          colors={['rgba(156, 48, 235, 0.3)', 'rgba(156, 48, 235, 0.2)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          className="web:md:flex web:md:flex-row rounded-twice overflow-hidden"
          style={Platform.OS === 'web' ? {} : { borderRadius: 20 }}
        >
          <ImageBackground
            source={require('@/assets/images/solid-purple-large.png')}
            resizeMode="contain"
            className="flex-1"
            imageStyle={{
              width: 461,
              height: 625,
              marginTop: isScreenMedium ? -100 : -50,
              marginRight: isScreenMedium ? 50 : -250,
              marginLeft: 'auto',
              opacity: 0.5,
            }}
          >
            <View className="flex-1 bg-transparent p-6 pb-10 md:px-10 md:py-8 justify-between gap-12 md:gap-4 border-b border-[#ffffff]/20 md:border-b-0 md:border-r">
              <View>
                <Text className="text-[1rem] md:text-lg text-primary/70">Total value</Text>
                <View className="flex-row items-center">
                  <SavingCountUp
                    prefix="$"
                    balance={balance ?? 0}
                    apy={apys?.allTime ?? 0}
                    lastTimestamp={firstDepositTimestamp ?? 0}
                    userDepositTransactions={userDepositTransactions}
                    classNames={{
                      wrapper: 'text-foreground',
                      decimalSeparator: 'text-2xl md:text-4.5xl font-medium',
                    }}
                    styles={{
                      wholeText: {
                        fontSize: isScreenMedium ? fontSize(6) : fontSize(3),
                        fontWeight: 'medium',
                        //fontFamily: 'MonaSans_500Medium',
                        color: '#ffffff',
                        marginRight: -2,
                      },
                      decimalText: {
                        fontSize: isScreenMedium ? fontSize(2.5) : fontSize(1.5),
                        fontWeight: '300',
                        //fontFamily: 'MonaSans_500Medium',
                        color: '#ffffff',
                      },
                    }}
                  />
                </View>
              </View>
              <View className="gap-1">
                <Text className="text-[1rem] md:text-lg text-primary/70">Interest earned</Text>
                <View className="flex-row items-center">
                  <SavingCountUp
                    prefix="$"
                    balance={balance ?? 0}
                    apy={apys?.allTime ?? 0}
                    lastTimestamp={firstDepositTimestamp ?? 0}
                    mode={SavingMode.CURRENT}
                    userDepositTransactions={userDepositTransactions}
                    classNames={{
                      decimalSeparator: 'md:text-xl font-medium',
                    }}
                    styles={{
                      wholeText: {
                        fontSize: isScreenMedium ? fontSize(2.5) : fontSize(2.25),
                        fontWeight: 'medium',
                        //fontFamily: 'MonaSans_500Medium',
                        color: '#ffffff',
                      },
                      decimalText: {
                        fontSize: isScreenMedium ? fontSize(1.25) : fontSize(1.125),
                        fontWeight: '300',
                        //fontFamily: 'MonaSans_500Medium',
                        color: '#ffffff',
                      },
                    }}
                  />
                </View>
              </View>
            </View>
          </ImageBackground>

          <View className="flex-row md:flex-col web:md:w-80 bg-transparent justify-left md:justify-center">
            <View className="p-6 md:p-7 yield-box">
              <View className="flex-row items-center gap-2 pb-1">
                <Text className="text-[1rem] md:text-lg text-primary/70">Current Yield</Text>
                <TooltipPopover text={`Last ${maxAPYDays} days yield of the vault`} />
              </View>
              <View className="flex-row items-center gap-2">
                <Text className="text-2xl text-brand font-semibold">
                  {isMaxAPYsLoading ? (
                    <Skeleton className="w-20 h-8 rounded-md bg-purple/50" />
                  ) : maxAPY ? (
                    `${formatNumber(maxAPY, 2)}%`
                  ) : (
                    '0%'
                  )}
                </Text>
                <Ping />
              </View>
            </View>

            <View className="border-r md:border-t border-[#ffffff]/20" />

            <View className="p-6 md:p-7">
              <View className="flex-row items-center gap-2 pb-1">
                <Text className="text-[1rem] md:text-lg text-primary/70">All time yield</Text>
                <TooltipPopover text="All time yield of the vault" />
              </View>
              <Text className="text-2xl font-semibold">
                {isAPYsLoading ? (
                  <Skeleton className="w-24 h-8 bg-purple/50 rounded-twice" />
                ) : (
                  `${apys ? formatNumber(apys.allTime, 2) : 0}%`
                )}
              </Text>
            </View>

            <View className="border-t border-[#ffffff]/20 hidden md:block" />

            <View className="p-6 md:p-7 hidden md:flex">
              <Text className="md:text-lg text-primary/70 pb-1">Projected 1Y Earnings</Text>
              <Text className="text-2xl font-semibold">
                {isBalanceLoading ? (
                  <Skeleton className="w-24 h-8 bg-purple/50 rounded-twice" />
                ) : (
                  `$${balance && apys?.allTime ? formatNumber(balance * (apys.allTime / 100), 2) : 0}`
                )}
              </Text>
            </View>
          </View>
        </LinearGradient>

        {!isScreenMedium && <SavingsHeaderButtonsMobile />}
      </View>
      <View className="md:px-0 w-full max-w-7xl mx-auto">
        <HomeBanners />
      </View>
      <View className="px-4 w-full max-w-7xl mx-auto">
        <FAQs faqs={faqs} className="md:mt-20" />
      </View>
    </>
  );

  return (
    <PageLayout desktopOnly isLoading={isLoading} scrollable={false}>
      <FlatList
        data={[{ key: 'content' }]}
        renderItem={() => renderContent()}
        keyExtractor={item => item.key}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ flexGrow: 1, paddingBottom: 100 }}
      />
    </PageLayout>
  );
}
