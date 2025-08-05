import { Text } from '@/components/ui/text';
import { WalletTabs } from '@/components/Wallet';
import React from 'react';
import { View } from 'react-native';

interface DashboardTokensProps {
  isTokensLoading: boolean;
  hasTokens: boolean;
}

const renderInfo = (text: string) => {
  return (
    <View className="flex-1 justify-center items-center p-8">
      <Text className="text-lg">{text}</Text>
    </View>
  );
};

export function DashboardTokens({ isTokensLoading, hasTokens }: DashboardTokensProps) {
  return (
    <View className="md:mt-6">
      {isTokensLoading ? (
        renderInfo('Loading tokens...')
      ) : hasTokens ? (
        <WalletTabs />
      ) : (
        renderInfo('No tokens found')
      )}
    </View>
  );
}
