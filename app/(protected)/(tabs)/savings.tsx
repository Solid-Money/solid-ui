import React, { useEffect, useMemo } from 'react';
import { ImageBackground, Platform, ScrollView, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Address } from 'viem';
import { useShallow } from 'zustand/react/shallow';

import { DashboardTitle } from '@/components/Dashboard';
import DashboardHeaderButtons from '@/components/Dashboard/DashboardHeaderButtons';
import { FAQs } from '@/components/FAQ';
import PageLayout from '@/components/PageLayout';
import Ping from '@/components/Ping';
import SavingCountUp from '@/components/SavingCountUp';
import SavingsEmptyState from '@/components/Savings/EmptyState';
import SavingsAnalytics from '@/components/Savings/SavingsAnalytics';
import SavingsHeaderButtonsMobile from '@/components/Savings/SavingsHeaderButtonsMobile';
import SavingVault from '@/components/Savings/SavingVault';
import TooltipPopover from '@/components/Tooltip';
import Skeleton from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import faqs from '@/constants/faqs';
import { VAULTS } from '@/constants/vaults';
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
import { useTotalVaultBalance, useVaultBalance } from '@/hooks/useVault';
import { useVaultExchangeRate } from '@/hooks/useVaultExchangeRate';
import { getAsset } from '@/lib/assets';
import { ADDRESSES } from '@/lib/config';
import { SavingMode } from '@/lib/types';
import { fontSize, formatNumber } from '@/lib/utils';
import { useDepositStore } from '@/store/useDepositStore';
import { useSavingStore } from '@/store/useSavingStore';

export default function Savings() {
  useRenderMonitor({ componentName: MONITORED_COMPONENTS.SAVINGS_SCREEN });

  const { user } = useUser();
  const { selectedVault } = useSavingStore();
  const { resetDepositFlow } = useDepositStore(
    useShallow(state => ({
      resetDepositFlow: state.resetDepositFlow,
    })),
  );
  const currentVault = VAULTS[selectedVault];
  const { isScreenMedium } = useDimension();

  const {
    data: balance,
    isLoading: isBalanceLoading,
    refetch: refetchBalance,
  } = useVaultBalance(user?.safeAddress as Address, currentVault);

  const {
    data: totalBalanceAllVaults,
    isLoading: isTotalBalanceLoading,
    refetch: refetchTotalBalance,
  } = useTotalVaultBalance(user?.safeAddress as Address);

  const { maxAPY, maxAPYDays, isAPYsLoading: isMaxAPYsLoading } = useMaxAPY(currentVault.type);
  const { data: apys, isLoading: isAPYsLoading } = useAPYs(currentVault.type);

  const { data: exchangeRate } = useVaultExchangeRate(currentVault.name);

  const rawAllTime = apys?.allTime;
  const vaultAPY =
    rawAllTime != null && Number.isFinite(Number(rawAllTime)) ? Number(rawAllTime) : 0;

  const { data: lastTimestamp } = useLatestTokenTransfer(
    user?.safeAddress ?? '',
    // Use correct token address based on selected vault
    currentVault.name === 'USDC' ? ADDRESSES.fuse.vault : ADDRESSES.fuse.fuseVault,
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
    currentVault.decimals,
  );

  // Controlled polling for balance/transaction updates - every 60 seconds instead of every block (~12s)
  useEffect(() => {
    const interval = setInterval(() => {
      refetchBalance();
      refetchTotalBalance();
      refetchTransactions();
    }, 60000); // 60 seconds
    return () => clearInterval(interval);
  }, [refetchBalance, refetchTotalBalance, refetchTransactions]);

  useEffect(() => {
    resetDepositFlow();
  }, [selectedVault, resetDepositFlow]);

  const isLoading = isBalanceLoading || isTransactionsLoading;
  const isEmptyStateLoading = isTotalBalanceLoading || isTransactionsLoading;

  const displayPrefix = useMemo(() => {
    if (VAULTS[selectedVault].name === 'USDC') {
      return '$';
    }
    return null;
  }, [selectedVault]);

  const displaySuffix = useMemo(() => {
    if (VAULTS[selectedVault].name === 'FUSE') {
      return 'FUSE';
    }
    return null;
  }, [selectedVault]);

  if (
    !totalBalanceAllVaults &&
    !userDepositTransactions?.deposits?.length &&
    !isEmptyStateLoading
  ) {
    return <SavingsEmptyState />;
  }

  // Calculate projected earnings
  const projectedEarnings =
    balance && vaultAPY ? balance * (exchangeRate ?? 1) * (vaultAPY / 100) : 0;

  return (
    <PageLayout isLoading={isLoading}>
      <View className="mx-auto w-full max-w-7xl gap-10 px-4 py-8 pt-6 md:gap-7 md:py-12">
        {isScreenMedium ? (
          <View className="flex-row items-center justify-between">
            <DashboardTitle />
            <DashboardHeaderButtons hideSend />
          </View>
        ) : (
          <Text className="text-3xl font-semibold">Savings</Text>
        )}
        {isScreenMedium ? (
          <View className="flex-row gap-4">
            <View className="flex-col gap-4">
              {VAULTS.map(vault => (
                <SavingVault key={vault.name} vault={vault} />
              ))}
            </View>
            <View
              className="relative flex-1 overflow-hidden rounded-twice web:md:flex web:md:flex-row"
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
                        prefix={displayPrefix}
                        suffix={displaySuffix ?? ''}
                        balance={balance ?? 0}
                        decimalPlaces={2}
                        decimals={currentVault.decimals}
                        apy={vaultAPY}
                        lastTimestamp={firstDepositTimestamp ?? 0}
                        userDepositTransactions={userDepositTransactions}
                        exchangeRate={exchangeRate}
                        tokenAddress={currentVault.vaults[0].address}
                        classNames={{
                          wrapper: 'text-foreground',
                          decimalSeparator: 'text-2xl md:text-4.5xl font-medium',
                        }}
                        styles={{
                          wholeText: {
                            fontSize: isScreenMedium ? fontSize(6) : fontSize(3),
                            fontWeight: 'medium',
                            fontFamily: 'MonaSans_500Medium',
                            color: '#ffffff',
                            marginRight: -2,
                          },
                          decimalText: {
                            fontSize: isScreenMedium ? fontSize(2.5) : fontSize(1.5),
                            fontWeight: '300',
                            fontFamily: 'MonaSans_500Medium',
                            color: '#ffffff',
                          },
                          suffixText: {
                            fontSize: isScreenMedium ? fontSize(2.5) : fontSize(1.5),
                          },
                        }}
                      />
                    </View>
                  </View>
                  <View className="gap-1">
                    <Text className="text-[1rem] text-primary/70 md:text-lg">Interest earned</Text>
                    <View className="flex-row items-center">
                      <SavingCountUp
                        prefix={displayPrefix}
                        suffix={displaySuffix ?? ''}
                        balance={balance ?? 0}
                        decimals={currentVault.decimals}
                        apy={vaultAPY}
                        lastTimestamp={firstDepositTimestamp ?? 0}
                        mode={SavingMode.CURRENT}
                        inputsReady={
                          !isAPYsLoading && Boolean(balance && (firstDepositTimestamp ?? 0) > 0)
                        }
                        userDepositTransactions={userDepositTransactions}
                        exchangeRate={exchangeRate}
                        tokenAddress={currentVault.vaults[0].address}
                        classNames={{
                          decimalSeparator: 'md:text-xl font-medium',
                        }}
                        styles={{
                          wholeText: {
                            fontSize: isScreenMedium ? fontSize(2.5) : fontSize(2.25),
                            fontWeight: 'medium',
                            fontFamily: 'MonaSans_500Medium',
                            color: '#ffffff',
                          },
                          decimalText: {
                            fontSize: isScreenMedium ? fontSize(1.25) : fontSize(1.125),
                            fontWeight: '300',
                            fontFamily: 'MonaSans_500Medium',
                            color: '#ffffff',
                          },
                          suffixText: {
                            fontSize: isScreenMedium ? fontSize(1.5) : fontSize(0.5),
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
                      `${formatNumber(vaultAPY, 2)}%`
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
                      `${displayPrefix ?? ''}${formatNumber(projectedEarnings, 2)}${displaySuffix ? ` ${displaySuffix}` : ''}`
                    )}
                  </Text>
                </View>
              </View>
            </View>
          </View>
        ) : (
          <>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 16, paddingHorizontal: 4 }}
              style={{ marginHorizontal: -4 }}
            >
              {VAULTS.map(vault => (
                <SavingVault key={vault.name} vault={vault} />
              ))}
            </ScrollView>
            <View
              className="relative -mt-7 overflow-hidden rounded-twice web:md:flex web:md:flex-row"
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
                        prefix={displayPrefix}
                        suffix={displaySuffix ?? ''}
                        balance={balance ?? 0}
                        decimalPlaces={2}
                        decimals={currentVault.decimals}
                        apy={vaultAPY}
                        lastTimestamp={firstDepositTimestamp ?? 0}
                        userDepositTransactions={userDepositTransactions}
                        exchangeRate={exchangeRate}
                        tokenAddress={currentVault.vaults[0].address}
                        classNames={{
                          wrapper: 'text-foreground',
                          decimalSeparator: 'text-2xl md:text-4.5xl font-medium',
                        }}
                        styles={{
                          wholeText: {
                            fontSize: isScreenMedium ? fontSize(6) : fontSize(3),
                            fontWeight: 'medium',
                            fontFamily: 'MonaSans_500Medium',
                            color: '#ffffff',
                            marginRight: -2,
                          },
                          decimalText: {
                            fontSize: isScreenMedium ? fontSize(2.5) : fontSize(1.5),
                            fontWeight: '300',
                            fontFamily: 'MonaSans_500Medium',
                            color: '#ffffff',
                          },
                          suffixText: {
                            fontSize: fontSize(2),
                          },
                        }}
                      />
                    </View>
                  </View>
                  <View className="gap-1">
                    <Text className="text-[1rem] text-primary/70 md:text-lg">Interest earned</Text>
                    <View className="flex-row items-center">
                      <SavingCountUp
                        prefix={displayPrefix}
                        suffix={displaySuffix ?? ''}
                        balance={balance ?? 0}
                        decimals={currentVault.decimals}
                        apy={vaultAPY}
                        lastTimestamp={firstDepositTimestamp ?? 0}
                        mode={SavingMode.CURRENT}
                        inputsReady={
                          !isAPYsLoading && Boolean(balance && (firstDepositTimestamp ?? 0) > 0)
                        }
                        userDepositTransactions={userDepositTransactions}
                        exchangeRate={exchangeRate}
                        tokenAddress={currentVault.vaults[0].address}
                        classNames={{
                          decimalSeparator: 'md:text-xl font-medium',
                        }}
                        styles={{
                          wholeText: {
                            fontSize: isScreenMedium ? fontSize(2.5) : fontSize(2.25),
                            fontWeight: 'medium',
                            fontFamily: 'MonaSans_500Medium',
                            color: '#ffffff',
                          },
                          decimalText: {
                            fontSize: isScreenMedium ? fontSize(1.25) : fontSize(1.125),
                            fontWeight: '300',
                            fontFamily: 'MonaSans_500Medium',
                            color: '#ffffff',
                          },
                          suffixText: {
                            fontSize: fontSize(1.5),
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
                      `${formatNumber(vaultAPY, 2)}%`
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
                      `${displayPrefix ?? ''}${formatNumber(projectedEarnings, 2)}${displaySuffix ? ` ${displaySuffix}` : ''}`
                    )}
                  </Text>
                </View>
              </View>
            </View>
          </>
        )}
        {currentVault?.name === 'USDC' && <SavingsAnalytics />}

        {!isScreenMedium && <SavingsHeaderButtonsMobile hideSend />}
      </View>
      <View className="mx-auto w-full max-w-7xl px-4 pb-24">
        <FAQs faqs={faqs} className="md:mt-20" />
      </View>
    </PageLayout>
  );
}
