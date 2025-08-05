import { DashboardHeaderMobile } from '@/components/Dashboard';
import NavbarMobile from '@/components/Navbar/NavbarMobile';
import CoinsMobile from '@/components/Wallet/CoinsMobile';
import React from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { HomeBanners } from './HomeBanners';

interface DashboardMobileProps {
  balanceData: {
    balance: number;
    totalAPY: number;
    firstDepositTimestamp: number;
    originalDepositAmount: number;
  };
}

export function DashboardMobile({ balanceData }: DashboardMobileProps) {
  const { balance, totalAPY, firstDepositTimestamp, originalDepositAmount } = balanceData;

  return (
    <SafeAreaView
      className="bg-background text-foreground flex-1"
      edges={['right', 'left', 'bottom', 'top']}
    >
      <ScrollView className="flex-1" contentContainerStyle={{ minHeight: '100%' }}>
        <NavbarMobile />
        <View className="gap-4 md:gap-16 px-4 pt-4 pb-8 w-full max-w-7xl mx-auto flex-1">
          <DashboardHeaderMobile
            balance={balance}
            totalAPY={totalAPY}
            lastTimestamp={firstDepositTimestamp}
            principal={originalDepositAmount}
          />
          <HomeBanners />
          {balance === 0 && <View className="flex-1" />}
          <CoinsMobile />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
