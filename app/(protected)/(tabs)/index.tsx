import { DashboardHeader, DashboardHeaderMobile } from "@/components/Dashboard";
import FAQ from "@/components/FAQ";
import Loading from "@/components/Loading";
import Navbar from "@/components/Navbar";
import NavbarMobile from "@/components/Navbar/NavbarMobile";
import Ping from "@/components/Ping";
import SavingCountUp from "@/components/SavingCountUp";
import SavingsEmptyState from "@/components/Savings/EmptyState";
import Transaction from "@/components/Transaction";
import { Skeleton } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import faqs from "@/constants/faqs";
import { useGetUserTransactionsQuery } from "@/graphql/generated/user-info";
import {
  formatTransactions,
  useLatestTokenTransfer,
  useSendTransactions,
  useTotalAPY,
} from "@/hooks/useAnalytics";
import { useDepositCalculations } from "@/hooks/useDepositCalculations";
import { SavingMode } from "@/lib/types";
import { useDimension } from "@/hooks/useDimension";
import useUser from "@/hooks/useUser";
import { useFuseVaultBalance } from "@/hooks/useVault";
import { ADDRESSES } from "@/lib/config";
import { useQuery } from "@tanstack/react-query";
import { LinearGradient } from "expo-linear-gradient";
import React, { useEffect } from "react";
import { ImageBackground, Platform, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Address } from "viem";
import { mainnet } from "viem/chains";
import { useBlockNumber } from "wagmi";

export default function Dashboard() {
  const { user } = useUser();
  const { isScreenMedium } = useDimension();
  const {
    data: balance,
    isLoading: isBalanceLoading,
    refetch: refetchBalance,
    isRefetching: isBalanceRefetching,
  } = useFuseVaultBalance(user?.safeAddress as Address);

  const { data: blockNumber } = useBlockNumber({
    watch: true,
    chainId: mainnet.id,
  });

  const { data: totalAPY, isLoading: isTotalAPYLoading } = useTotalAPY();
  const { data: lastTimestamp } = useLatestTokenTransfer(
    user?.safeAddress ?? "",
    ADDRESSES.fuse.vault
  );

  const {
    data: userDepositTransactions,
    loading: isTransactionsLoading,
    refetch: refetchTransactions,
  } = useGetUserTransactionsQuery({
    variables: {
      address: user?.safeAddress?.toLowerCase() ?? "",
    },
  });

  const {
    data: sendTransactions,
    isLoading: isSendTransactionsLoading,
    refetch: refetchSendTransactions,
  } = useSendTransactions(user?.safeAddress ?? "");

  const {
    data: transactions,
    isLoading: isFormattingTransactions,
    refetch: refetchFormattedTransactions,
  } = useQuery({
    queryKey: ["formatted-transactions", userDepositTransactions],
    queryFn: () => formatTransactions(userDepositTransactions, sendTransactions),
    enabled: !!userDepositTransactions,
  });

  const {originalDepositAmount, firstDepositTimestamp} =
    useDepositCalculations(userDepositTransactions, balance, lastTimestamp);

  useEffect(() => {
    refetchBalance();
    refetchTransactions();
    refetchFormattedTransactions();
    refetchSendTransactions();
  }, [blockNumber, refetchBalance, refetchTransactions, refetchFormattedTransactions, refetchSendTransactions]);

  if (isBalanceLoading || isTransactionsLoading) {
    return <Loading />;
  }

  if (!balance && !userDepositTransactions?.deposits?.length) {
    return <SavingsEmptyState />;
  }

  return (
    <>
      {Platform.OS !== 'web' && <NavbarMobile />}
      <SafeAreaView
        className="bg-background text-foreground flex-1"
        edges={["right", "left", "bottom"]}
      >
        <ScrollView className="flex-1">
          {Platform.OS === 'web' && <Navbar />}
          <View className="gap-12 md:gap-16 px-4 py-8 w-full max-w-7xl mx-auto">
            {Platform.OS === 'web' ? (
              <DashboardHeader />
            ) : (
              <DashboardHeaderMobile
                balance={balance ?? 0}
                totalAPY={totalAPY ?? 0}
                lastTimestamp={firstDepositTimestamp ?? 0}
                principal={originalDepositAmount}
              />
            )}
            <LinearGradient
              colors={["rgba(126, 126, 126, 0.3)", "rgba(126, 126, 126, 0.2)"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              className="web:md:flex web:md:flex-row rounded-twice overflow-hidden"
            >
              <ImageBackground
                source={require("@/assets/images/solid-black-large.png")}
                resizeMode="contain"
                className="flex-1"
                imageStyle={{
                  width: 461,
                  height: 625,
                  marginTop: isScreenMedium ? -100 : -50,
                  marginRight: isScreenMedium ? 50 : -250,
                  marginLeft: "auto",
                }}
              >
                <View className="flex-1 bg-transparent p-6 pb-16 md:px-10 md:py-8 justify-between gap-12 md:gap-4 border-b border-border md:border-b-0 md:border-r">
                  <View>
                    <Text className="md:text-lg text-primary/50 font-medium">
                      Total value
                    </Text>
                    <View className="flex-row items-center">
                      <Text className="text-5xl md:text-8xl text-foreground font-semibold">
                        $
                      </Text>
                      <SavingCountUp
                        balance={balance ?? 0}
                        apy={totalAPY ?? 0}
                        lastTimestamp={firstDepositTimestamp ?? 0}
                        principal={originalDepositAmount}
                        decimalPlaces={10}
                        classNames={{
                          wrapper: "text-foreground",
                          decimalSeparator:
                            "text-2xl md:text-4.5xl font-medium",
                        }}
                        styles={{
                          wholeText: {
                            fontSize: isScreenMedium ? 96 : 48,
                            fontWeight: isScreenMedium ? "medium" : "semibold",
                            color: "#ffffff",
                            marginRight: -2,
                          },
                          decimalText: {
                            fontSize: isScreenMedium ? 40 : 24,
                            fontWeight: isScreenMedium ? "medium" : "semibold",
                            color: "#ffffff",
                          },
                        }}
                      />
                    </View>
                  </View>
                  <View className="gap-1">
                    <Text className="md:text-lg text-primary/50 font-medium">
                      Interest earned
                    </Text>
                    <View className="flex-row items-center">
                      <Text className="text-4xl md:text-4.5xl text-brand font-medium">
                        $
                      </Text>
                      <SavingCountUp
                        balance={balance ?? 0}
                        apy={totalAPY ?? 0}
                        lastTimestamp={firstDepositTimestamp ?? 0}
                        principal={originalDepositAmount}
                        mode={SavingMode.INTEREST_ONLY}
                        decimalPlaces={4}
                        classNames={{
                          decimalSeparator: "md:text-xl text-brand font-medium",
                        }}
                        styles={{
                          wholeText: {
                            fontSize: isScreenMedium ? 40 : 36,
                            fontWeight: "semibold",
                            color: "#94F27F",
                          },
                          decimalText: {
                            fontSize: isScreenMedium ? 20 : 18,
                            color: "#94F27F",
                          },
                        }}
                      />
                    </View>
                  </View>
                </View>
              </ImageBackground>

              <View className="flex-row md:flex-col web:md:w-80 bg-transparent justify-between md:justify-center">
                <View className="p-6 md:p-7">
                  <Text className="md:text-lg text-primary/50 font-medium">
                    Current Yield
                  </Text>
                  <View className="flex-row items-center gap-2">
                    <Text className="text-2xl text-brand font-semibold">
                      {isTotalAPYLoading ? (
                        <Skeleton className="w-20 h-8 rounded-md" />
                      ) : totalAPY ? (
                        `${totalAPY.toFixed(1)}%`
                      ) : (
                        "0%"
                      )}
                    </Text>
                    <Ping />
                  </View>
                </View>

                <View className="border-r md:border-t border-border/50" />

                <View className="p-6 md:p-7">
                  <Text className="md:text-lg text-primary/50 font-medium">
                    Total deposited
                  </Text>
                  <Text className="text-2xl font-semibold">
                    {isBalanceLoading && !isBalanceRefetching ? (
                      <Skeleton className="w-24 h-8 bg-primary/10 rounded-twice" />
                    ) : (
                      `$${originalDepositAmount.toLocaleString()}`
                    )}
                  </Text>
                </View>

                <View className="border-t border-border/50 hidden md:block" />

                <View className="p-6 md:p-7 hidden md:block">
                  <Text className="md:text-lg text-primary/50 font-medium">
                    Total earned
                  </Text>
                  <View className="flex-row items-center">
                    <Text className="text-2xl font-semibold">$</Text>
                    {(isTotalAPYLoading || isBalanceLoading) &&
                      !isBalanceRefetching ? (
                      <Skeleton className="w-20 h-8 bg-primary/10 rounded-twice" />
                    ) : (
                      <SavingCountUp
                        balance={balance ?? 0}
                        apy={totalAPY ?? 0}
                        lastTimestamp={firstDepositTimestamp ?? 0}
                        principal={originalDepositAmount}
                        styles={{
                          wholeText: {
                            fontSize: 24,
                            fontWeight: "semibold",
                            color: "#ffffff",
                          },
                          decimalText: {
                            fontSize: 16,
                            color: "#ffffff",
                          },
                        }}
                      />
                    )}
                  </View>
                </View>
              </View>
            </LinearGradient>

            <View className="gap-4">
              <Text className="text-2xl font-medium">Recent transactions</Text>
              <View>
                {isTransactionsLoading || isFormattingTransactions || isSendTransactionsLoading ? (
                  <Skeleton className="w-full h-16 bg-card rounded-xl md:rounded-twice" />
                ) : transactions?.length ? (
                  transactions.map((transaction, index) => (
                    <Transaction
                      key={transaction.timestamp}
                      {...transaction}
                      classNames={{
                        container: index === 0 ? "rounded-t-twice" : index === transactions.length - 1 ? "rounded-b-twice border-0" : "",
                      }}
                    />
                  ))
                ) : (
                  <Text className="text-muted-foreground">
                    No transactions found
                  </Text>
                )}
              </View>
            </View>

            <View className="flex-col items-center gap-6 md:gap-12 w-full max-w-screen-md mx-auto md:mt-20">
              <Text className="text-3xl font-semibold text-center">
                Frequently asked questions
              </Text>
              <FAQ faqs={faqs} />
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </>
  );
}
