import { SavingCard, WalletCard } from '@/components/Wallet';
import { GetUserTransactionsQuery } from '@/graphql/generated/user-info';
import { TokenBalance } from '@/lib/types';
import React from 'react';
import { View } from 'react-native';

interface DashboardCardsProps {
  totalUSD: number;
  tokens: TokenBalance[];
  balance?: number;
  isBalanceLoading?: boolean;
  firstDepositTimestamp?: number;
  userDepositTransactions?: GetUserTransactionsQuery;
}

export function DashboardCards({
  totalUSD,
  tokens,
  balance,
  isBalanceLoading,
  firstDepositTimestamp,
  userDepositTransactions,
}: DashboardCardsProps) {
  return (
    <View className="md:flex-row justify-between items-center gap-6 md:min-h-40">
      <WalletCard balance={totalUSD} tokens={tokens} className="gap-4 md:w-[50%] h-fit md:h-full" />
      <SavingCard
        className="gap-4 md:w-[50%] h-fit md:h-full"
        balance={balance}
        isBalanceLoading={isBalanceLoading}
        firstDepositTimestamp={firstDepositTimestamp}
        userDepositTransactions={userDepositTransactions}
      />
    </View>
  );
}
