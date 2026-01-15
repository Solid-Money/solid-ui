import React, { useEffect } from 'react';
import { ImageBackground, Platform, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Address } from 'viem';

import { DashboardTitle } from '@/components/Dashboard';
import DashboardHeaderButtons from '@/components/Dashboard/DashboardHeaderButtons';
import { FAQs } from '@/components/FAQ';
import PageLayout from '@/components/PageLayout';
import Ping from '@/components/Ping';
import SavingCountUp from '@/components/SavingCountUp';
import SavingsEmptyState from '@/components/Savings/EmptyState';
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
import { MONITORED_COMPONENTS, useRenderMonitor } from '@/hooks/useRenderMonitor';
import useUser from '@/hooks/useUser';
import { useVaultBalance } from '@/hooks/useVault';
import { getAsset } from '@/lib/assets';
import { ADDRESSES } from '@/lib/config';
import { SavingMode } from '@/lib/types';
import { fontSize, formatNumber } from '@/lib/utils';

export default function Savings() {
  useRenderMonitor({ componentName: MONITORED_COMPONENTS.SAVINGS_SCREEN });

  const { user } = useUser();
  const { isScreenMedium } = useDimension();
  const {
    data: balance,
    isLoading: isBalanceLoading,
    refetch: refetchBalance,
  } = useVaultBalance(user?.safeAddress as Address);
  const { maxAPY, maxAPYDays, isAPYsLoading: isMaxAPYsLoading } = useMaxAPY();
  const { data: apys, isLoading: isAPYsLoading } = useAPYs();

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

  return (
    <PageLayout isLoading={isLoading}>
      <View className="mx-auto w-full max-w-7xl gap-8 px-4 py-8 pt-6 md:gap-9 md:py-12">
        {isScreenMedium ? (
          <View className="flex-row items-center justify-between">
            <DashboardTitle />
            <DashboardHeaderButtons />
          </View>
        ) : (
          <Text className="text-3xl font-semibold">Savings</Text>
        )}
        <View
          className="relative overflow-hidden rounded-twice web:md:flex web:md:flex-row"
          style={Platform.OS === 'web' ? {} : { borderRadius: 20 }}
        >
          <LinearGradient
            colors={['rgba(122, 84, 234, 1)', 'rgba(122, 84, 234, 0.5)']}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.6, y: 1 }}
            pointerEvents="none"
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              top: 0,
              bottom: 0,
              zIndex: -1,
              opacity: 0.3,
            }}
          />
          <ImageBackground
            source={getAsset('images/solid-black-large.png')}
            resizeMode="contain"
            className="relative flex-1"
            style={{ mixBlendMode: 'luminosity' }}
            imageStyle={{
              width: 461,
              height: 625,
              marginTop: isScreenMedium ? -100 : -50,
              marginRight: isScreenMedium ? 50 : -250,
              marginLeft: 'auto',
            }}
          >
            <View className="flex-1 justify-between gap-12 border-b border-[#ffffff]/20 bg-transparent p-6 pb-10 md:gap-4 md:border-b-0 md:border-r md:px-10 md:py-8">
              <View>
                <Text className="text-[1rem] text-primary/70 md:text-lg">Total value</Text>
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
                <Text className="text-[1rem] text-primary/70 md:text-lg">Interest earned</Text>
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

          <View className="justify-left relative flex-row bg-transparent md:flex-col md:justify-center web:md:w-80">
            <View className="yield-box p-6 md:p-7">
              <View className="flex-row items-center gap-2 pb-1">
                <Text className="text-[1rem] text-primary/70 md:text-lg">Current Yield</Text>
                <TooltipPopover text={`Last ${maxAPYDays} days yield of the vault`} />
              </View>
              <View className="flex-row items-center gap-2">
                <Text className="text-2xl font-semibold text-brand">
                  {isMaxAPYsLoading ? (
                    <Skeleton className="h-8 w-20 rounded-md bg-purple/50" />
                  ) : maxAPY ? (
                    `${formatNumber(maxAPY, 2)}%`
                  ) : (
                    '0%'
                  )}
                </Text>
                <Ping />
              </View>
            </View>

            <View className="border-r border-[#ffffff]/20 md:border-t" />

            <View className="p-6 md:p-7">
              <View className="flex-row items-center gap-2 pb-1">
                <Text className="text-[1rem] text-primary/70 md:text-lg">All time yield</Text>
                <TooltipPopover text="All time yield of the vault" />
              </View>
              <Text className="text-2xl font-semibold">
                {isAPYsLoading ? (
                  <Skeleton className="h-8 w-24 rounded-twice bg-purple/50" />
                ) : (
                  `${apys ? formatNumber(apys.allTime, 2) : 0}%`
                )}
              </Text>
            </View>

            <View className="hidden border-t border-[#ffffff]/20 md:block" />

            <View className="hidden p-6 md:flex md:p-7">
              <Text className="pb-1 text-primary/70 md:text-lg">Projected 1Y Earnings</Text>
              <Text className="text-2xl font-semibold">
                {isBalanceLoading ? (
                  <Skeleton className="h-8 w-24 rounded-twice bg-purple/50" />
                ) : (
                  `$${balance && apys?.allTime ? formatNumber(balance * (apys.allTime / 100), 2) : 0}`
                )}
              </Text>
            </View>
          </View>
        </View>

        {!isScreenMedium && <SavingsHeaderButtonsMobile />}
      </View>
      <View className="mx-auto w-full max-w-7xl px-4 pb-24">
        <FAQs faqs={faqs} className="md:mt-20" />
      </View>
    </PageLayout>
  );
}
