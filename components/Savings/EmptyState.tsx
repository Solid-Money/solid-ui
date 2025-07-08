import { Image } from "expo-image";
import { LinearGradient } from 'expo-linear-gradient';
import { Link } from "expo-router";
import React from "react";
import { Platform, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import NavbarMobile from "@/components/Navbar/NavbarMobile";
import { Skeleton } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import { useTotalAPY } from "@/hooks/useAnalytics";
import { useDimension } from "@/hooks/useDimension";
import { DepositOptionModal } from "../DepositOption";
import FAQ from "../FAQ";
import faqs from "@/constants/faqs";
import Navbar from "../Navbar";

export default function SavingsEmptyState() {
  const { data: totalAPY, isLoading: isTotalAPYLoading } = useTotalAPY()
  const { isScreenMedium } = useDimension();

  return (
    <>
      {Platform.OS !== 'web' && <NavbarMobile />}
      <SafeAreaView
        className="bg-background text-foreground flex-1"
        edges={['right', 'left', 'bottom']}
      >
        <ScrollView className="flex-1">
          {Platform.OS === 'web' && <Navbar />}
          <View className="w-full max-w-7xl mx-auto gap-12 md:gap-16 px-4 py-8">
            <View className="md:flex-row justify-between md:items-center gap-y-4">
              <View className="gap-3">
                <Text className="text-3xl font-semibold">
                  Your saving account
                </Text>
                <Text className="max-w-lg">
                  <Text className="opacity-70">
                    Our Solid vault will automatically manage your funds to maximize your yield without exposing you to unnecessary risk.
                  </Text>{" "}
                  <Link href="https://solid-3.gitbook.io/solid.xyz-docs" target="_blank" className='text-primary font-medium underline hover:opacity-70'>How it works</Link>
                </Text>
              </View>
              <View className="flex-row items-center gap-5">
                <DepositOptionModal />
                {/* <Link href={path.DEPOSIT} className={buttonVariants({ variant: "brand", className: "h-12 rounded-xl" })}>
                  <View className="flex-row items-center gap-2">
                    <Plus />
                    <Text className="text-primary-foreground font-bold">Deposit USD</Text>
                  </View>
                </Link> */}
              </View>
            </View>

            <LinearGradient
              colors={['rgba(126, 126, 126, 0.3)', 'rgba(126, 126, 126, 0.2)']}
              style={{
                borderRadius: 20,
                padding: isScreenMedium ? 40 : 20,
                gap: isScreenMedium ? 96 : 40,
              }}
            >
              <View className="flex-col md:flex-row justify-between gap-10 md:gap-0">
                <View className="justify-between gap-10 md:gap-0 w-full max-w-2xl">
                  <Text className="text-4xl md:text-4.5xl font-semibold max-w-lg">
                    Deposit your stablecoins and earn {isTotalAPYLoading ?
                      <Skeleton className="w-24 h-10 bg-brand/20" /> :
                      <Text className="text-4xl md:text-4.5xl text-brand font-bold underline">
                        {totalAPY?.toFixed(2)}%
                      </Text>
                    } per year
                  </Text>
                  <View className="flex-col md:flex-row justify-between md:items-center gap-x-4 gap-y-5">
                    <View className="flex-row md:flex-col items-center md:items-start gap-4">
                      <Image
                        source={require("@/assets/images/deposit.png")}
                        contentFit="contain"
                        style={{ width: 64, height: 64 }}
                      />
                      <Text className="text-2xl md:max-w-36">
                        Earn from as little as $1
                      </Text>
                    </View>
                    <View className="flex-row md:flex-col items-center md:items-start gap-4">
                      <Image
                        source={require("@/assets/images/withdraw.png")}
                        contentFit="contain"
                        style={{ width: 64, height: 64 }}
                      />
                      <Text className="text-2xl md:max-w-32">
                        Withdraw anytime
                      </Text>
                    </View>
                    <View className="flex-row md:flex-col items-center md:items-start gap-4">
                      <Image
                        source={require("@/assets/images/earn.png")}
                        contentFit="contain"
                        style={{ width: 64, height: 64 }}
                      />
                      <Text className="text-2xl md:max-w-32">
                        Earn every second
                      </Text>
                    </View>
                  </View>
                </View>
                <View>
                  <Image
                    source={require("@/assets/images/solid-purple-large.png")}
                    contentFit="contain"
                    style={{ width: 349, height: 378 }}
                  />
                </View>
              </View>
            </LinearGradient>
            <View className="flex-col items-center gap-6 md:gap-12 w-full max-w-screen-md mx-auto md:mt-8">
              <Text className="text-3xl font-semibold text-center">
                Frequently asked questions
              </Text>
              <FAQ faqs={faqs} />
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </>
  )
}