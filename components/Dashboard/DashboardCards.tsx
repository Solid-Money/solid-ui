import { SavingCard, WalletCard } from '@/components/Wallet';
import { TokenBalance } from '@/lib/types';
import React from 'react';
import { View } from 'react-native';

interface DashboardCardsProps {
  totalUSD: number;
  tokens: TokenBalance[];
}

export function DashboardCards({ totalUSD, tokens }: DashboardCardsProps) {
  return (
    <View className="md:flex-row justify-between items-center gap-6 md:min-h-40">
      <WalletCard balance={totalUSD} tokens={tokens} className="gap-4 md:w-[50%] h-fit md:h-full" />
      <SavingCard className="gap-4 md:w-[50%] h-fit md:h-full" />
    </View>
  );
}
