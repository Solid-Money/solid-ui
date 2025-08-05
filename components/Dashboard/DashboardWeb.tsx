import { DashboardHeader } from '@/components/Dashboard';
import FAQ from '@/components/FAQ';
import Navbar from '@/components/Navbar';
import Ping from '@/components/Ping';
import SavingCountUp from '@/components/SavingCountUp';
import Transaction from '@/components/Transaction';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import faqs from '@/constants/faqs';
import { useDimension } from '@/hooks/useDimension';
import { calculateYield } from '@/lib/financial';
import { SavingMode, Transaction as TransactionType } from '@/lib/types';
import { fontSize, formatNumber } from '@/lib/utils';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { ImageBackground, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

interface DashboardWebProps {
  balanceData: {
    balance: number;
    totalAPY: number;
    firstDepositTimestamp: number;
    originalDepositAmount: number;
  };
  transactionData: {
    transactions: TransactionType[];
    getTransactionClassName: (total: number, index: number) => string;
  };
  isLoading: {
    balance: boolean;
    totalAPY: boolean;
    transactions: boolean;
  };
}

export function DashboardWeb({ balanceData, transactionData, isLoading }: DashboardWebProps) {
  const { isScreenMedium } = useDimension();
  const { balance, totalAPY, firstDepositTimestamp, originalDepositAmount } = balanceData;
  const { transactions, getTransactionClassName } = transactionData;

  return (
    <SafeAreaView
      className="bg-background text-foreground flex-1"
      edges={['right', 'left', 'bottom', 'top']}
    >
      <ScrollView className="flex-1">
        <Navbar />
        <View className="gap-12 md:gap-16 px-4 pt-4 pb-8 w-full max-w-7xl mx-auto">
          <DashboardHeader />
          <LinearGradient
            colors={['rgba(126, 126, 126, 0.3)', 'rgba(126, 126, 126, 0.2)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            className="web:md:flex web:md:flex-row rounded-twice overflow-hidden"
          >
            <ImageBackground
              source={require('@/assets/images/solid-black-large.png')}
              resizeMode="contain"
              className="flex-1"
              imageStyle={{
                width: 461,
                height: 625,
                marginTop: isScreenMedium ? -100 : -50,
                marginRight: isScreenMedium ? 50 : -250,
                marginLeft: 'auto',
              }}
            >
              <View className="flex-1 bg-transparent p-6 pb-16 md:px-10 md:py-8 justify-between gap-12 md:gap-4 border-b border-border md:border-b-0 md:border-r">
                <View>
                  <Text className="md:text-lg text-primary/50 font-medium">Total value</Text>
                  <View className="flex-row items-center">
                    <Text className="text-5xl md:text-8xl native:leading-[1.2] text-foreground font-semibold">
                      $
                    </Text>
                    <SavingCountUp
                      balance={balance}
                      apy={totalAPY}
                      lastTimestamp={firstDepositTimestamp}
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
                  </View>
                </View>
                <View className="gap-1">
                  <Text className="md:text-lg text-primary/50 font-medium">Interest earned</Text>
                  <View className="flex-row items-center">
                    <Text className="text-4xl md:text-4.5xl native:leading-[1.2] text-brand font-medium">
                      $
                    </Text>
                    <SavingCountUp
                      balance={balance}
                      apy={totalAPY}
                      lastTimestamp={firstDepositTimestamp}
                      principal={originalDepositAmount}
                      mode={SavingMode.INTEREST_ONLY}
                      classNames={{
                        decimalSeparator: 'md:text-xl text-brand font-medium',
                      }}
                      styles={{
                        wholeText: {
                          fontSize: isScreenMedium ? fontSize(2.5) : fontSize(2.25),
                          fontWeight: 'semibold',
                          color: '#94F27F',
                        },
                        decimalText: {
                          fontSize: isScreenMedium ? fontSize(1.25) : fontSize(1.125),
                          color: '#94F27F',
                        },
                      }}
                    />
                  </View>
                </View>
              </View>
            </ImageBackground>

            <View className="flex-row md:flex-col web:md:w-80 bg-transparent justify-between md:justify-center">
              <View className="p-6 md:p-7">
                <Text className="md:text-lg text-primary/50 font-medium">Current Yield</Text>
                <View className="flex-row items-center gap-2">
                  <Text className="text-2xl text-brand font-semibold">
                    {isLoading.totalAPY ? (
                      <Skeleton className="w-20 h-8 rounded-md" />
                    ) : totalAPY ? (
                      `${totalAPY.toFixed(2)}%`
                    ) : (
                      '0%'
                    )}
                  </Text>
                  <Ping />
                </View>
              </View>

              <View className="border-r md:border-t border-border/50" />

              <View className="p-6 md:p-7">
                <Text className="md:text-lg text-primary/50 font-medium">P&L</Text>
                <Text className="text-2xl font-semibold">
                  {isLoading.balance ? (
                    <Skeleton className="w-24 h-8 bg-primary/10 rounded-twice" />
                  ) : (
                    `$${calculateYield(
                      originalDepositAmount,
                      totalAPY,
                      firstDepositTimestamp,
                      Math.floor(Date.now() / 1000),
                      originalDepositAmount,
                      SavingMode.INTEREST_ONLY,
                    ).toFixed(6)}`
                  )}
                </Text>
              </View>

              <View className="border-t border-border/50 hidden md:block" />

              <View className="p-6 md:p-7 hidden md:flex">
                <Text className="md:text-lg text-primary/50 font-medium">
                  Projected 1Y Earnings
                </Text>
                <Text className="text-2xl font-semibold">
                  {isLoading.balance ? (
                    <Skeleton className="w-24 h-8 bg-primary/10 rounded-twice" />
                  ) : (
                    `$${balance && totalAPY ? formatNumber(balance * (totalAPY / 100), 0) : 0}`
                  )}
                </Text>
              </View>
            </View>
          </LinearGradient>

          <View className="gap-4">
            <Text className="text-2xl font-medium">Recent transactions</Text>
            <View>
              {isLoading.transactions ? (
                <Skeleton className="w-full h-16 bg-card rounded-xl md:rounded-twice" />
              ) : transactions?.length ? (
                transactions.map((transaction, index) => (
                  <Transaction
                    key={transaction.timestamp}
                    {...transaction}
                    classNames={{
                      container: getTransactionClassName(transactions.length, index),
                    }}
                  />
                ))
              ) : (
                <Text className="text-muted-foreground">No transactions found</Text>
              )}
            </View>
          </View>

          <View className="flex-col items-center gap-6 md:gap-12 w-full max-w-screen-md mx-auto md:mt-20">
            <Text className="text-3xl font-semibold text-center">Frequently asked questions</Text>
            <FAQ faqs={faqs} />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
