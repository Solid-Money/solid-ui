import { SavingCard, WalletCard } from '@/components/Wallet';
import React from 'react';
import { View } from 'react-native';

interface DashboardCardsProps {
  totalUSD: number;
  savings: number;
}

export function DashboardCards({ totalUSD, savings }: DashboardCardsProps) {
  return (
    <View className="md:flex-row justify-between items-center gap-6 md:min-h-40">
      <WalletCard balance={totalUSD} className="gap-4 md:w-[50%] h-fit md:h-full" />
      <SavingCard savings={savings} className="gap-4 md:w-[50%] h-fit md:h-full" />
    </View>
  );
}
