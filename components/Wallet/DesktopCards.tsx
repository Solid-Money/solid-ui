import { Card, SavingCard, WalletCard } from '@/components/Wallet';
import { USDC_TOKEN_BALANCE } from '@/constants/tokens';
import { TokenBalance } from '@/lib/types';
import React from 'react';
import { View } from 'react-native';

type DesktopCardsProps = {
  totalUSDExcludingSoUSD: number;
  topThreeTokens: TokenBalance[];
  isLoadingTokens: boolean;
  userHasCard: boolean;
  cardBalance: number;
};

export default function DesktopCards({
  totalUSDExcludingSoUSD,
  topThreeTokens,
  isLoadingTokens,
  userHasCard,
  cardBalance,
}: DesktopCardsProps) {
  return (
    <View className="flex-row gap-6 min-h-44">
      <WalletCard
        balance={totalUSDExcludingSoUSD}
        className="flex-1"
        tokens={topThreeTokens}
        isLoading={isLoadingTokens}
        decimalPlaces={2}
      />
      {userHasCard && (
        <Card
          balance={cardBalance}
          className="flex-1"
          tokens={[USDC_TOKEN_BALANCE]}
          isLoading={isLoadingTokens}
          decimalPlaces={2}
        />
      )}
      <SavingCard className="flex-1" decimalPlaces={2} />
    </View>
  );
}
