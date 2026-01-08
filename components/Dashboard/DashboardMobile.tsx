import { DashboardHeaderMobile } from '@/components/Dashboard';
import NavbarMobile from '@/components/Navbar/NavbarMobile';
import CoinsMobile from '@/components/Wallet/CoinsMobile';
import { Image } from 'expo-image';
import React from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getAsset } from '@/lib/assets';

interface DashboardMobileProps {
  balanceData: {
    balance: number;
    totalAPY: number;
    firstDepositTimestamp: number;
  };
}

export function DashboardMobile({ balanceData }: DashboardMobileProps) {
  const { balance, totalAPY, firstDepositTimestamp } = balanceData;

  return (
    <SafeAreaView
      className="flex-1 bg-background text-foreground"
      edges={['right', 'left', 'bottom', 'top']}
    >
      <ScrollView className="flex-1" contentContainerStyle={{ minHeight: '100%' }}>
        <NavbarMobile />
        <View className="mx-auto w-full max-w-7xl flex-1 gap-4 px-4 pb-8 pt-4 md:gap-16">
          <DashboardHeaderMobile
            balance={balance}
            totalAPY={totalAPY}
            lastTimestamp={firstDepositTimestamp}
          />
          <Image
            source={getAsset('images/deposit_banner.png')}
            style={{ width: '100%', aspectRatio: 688 / 171, marginTop: 28 }}
            contentFit="contain"
          />
          {balance !== 0 && (
            <>
              <View className="flex-1" />
              <CoinsMobile />
            </>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
