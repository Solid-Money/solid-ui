import React, { useEffect } from "react";
import { Platform, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Address } from "viem";
import { mainnet } from "viem/chains";
import { useBlockNumber } from "wagmi";

import Navbar from "@/components/Navbar";
import NavbarMobile from "@/components/Navbar/NavbarMobile";
import SavingCountUp from "@/components/SavingCountUp";
import { Text } from "@/components/ui/text";
import { WalletTabs } from "@/components/Wallet";
import { useGetUserTransactionsQuery } from "@/graphql/generated/user-info";
import { useLatestTokenTransfer, useTotalAPY } from "@/hooks/useAnalytics";
import { useDepositCalculations } from "@/hooks/useDepositCalculations";
import { useDimension } from "@/hooks/useDimension";
import useUser from "@/hooks/useUser";
import { useFuseVaultBalance } from "@/hooks/useVault";
import { ADDRESSES } from "@/lib/config";

export default function Wallet() {
  const { user } = useUser();
  const { isScreenMedium } = useDimension();
  const {
    data: blockNumber
  } = useBlockNumber({ watch: true, chainId: mainnet.id })
  const {
    data: balance,
    refetch: refetchBalance,
  } = useFuseVaultBalance(
    user?.safeAddress as Address
  );
  const { data: totalAPY } = useTotalAPY();
  const { data: lastTimestamp } = useLatestTokenTransfer(
    user?.safeAddress ?? "",
    ADDRESSES.fuse.vault
  );
  const {
    data: userDepositTransactions,
    refetch: refetchTransactions,
  } = useGetUserTransactionsQuery({
    variables: {
      address: user?.safeAddress?.toLowerCase() ?? "",
    },
  });
  const { originalDepositAmount, firstDepositTimestamp } =
    useDepositCalculations(userDepositTransactions, balance, lastTimestamp);

  useEffect(() => {
    refetchBalance()
    refetchTransactions()
  }, [blockNumber, refetchBalance, refetchTransactions])

  return (
    <React.Fragment>
      {Platform.OS !== 'web' && <NavbarMobile />}
      <SafeAreaView
        className="bg-background text-foreground flex-1"
        edges={['right', 'left', 'bottom']}
      >
        <ScrollView className="flex-1">
          {Platform.OS === 'web' && <Navbar />}
          <View className="gap-12 md:gap-16 px-4 py-8 md:py-16 w-full max-w-7xl mx-auto">
            <View className="flex-row items-center justify-between gap-y-4">
              <View className="flex-row items-center">
                <Text className="text-5xl md:text-8xl text-foreground font-semibold">$</Text>
                <SavingCountUp
                  balance={balance ?? 0}
                  apy={totalAPY ?? 0}
                  lastTimestamp={firstDepositTimestamp ?? 0}
                  principal={originalDepositAmount}
                  decimalPlaces={4}
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
                      marginRight: -5,
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

            <View className="md:mt-6">
              <WalletTabs />
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </React.Fragment>
  );
}
