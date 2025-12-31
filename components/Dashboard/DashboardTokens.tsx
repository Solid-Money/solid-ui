import { Text } from '@/components/ui/text';
import { WalletTabs } from '@/components/Wallet';
import React from 'react';
import { TouchableOpacity, View } from 'react-native';

interface DashboardTokensProps {
  isTokensLoading: boolean;
  hasTokens: boolean;
  error?: string | null;
  onRetry?: () => void;
  isRefreshing?: boolean;
}

const renderInfo = (text: string, error?: string | null, onRetry?: () => void) => {
  return (
    <View className="flex-1 justify-center items-center p-8">
      <Text className="text-lg">{text}</Text>
      {error && (
        <>
          <Text className="text-sm text-muted-foreground mt-2">{error}</Text>
          {onRetry && (
            <TouchableOpacity onPress={onRetry} className="mt-4 px-4 py-2 bg-primary rounded-lg">
              <Text className="text-primary-foreground">Retry</Text>
            </TouchableOpacity>
          )}
        </>
      )}
    </View>
  );
};

export function DashboardTokens({
  isTokensLoading,
  hasTokens,
  error,
  onRetry,
  isRefreshing,
}: DashboardTokensProps) {
  return (
    <View className="md:mt-6">
      {error ? (
        renderInfo('Failed to load tokens', error, onRetry)
      ) : isTokensLoading && !isRefreshing ? (
        renderInfo('Loading tokens...')
      ) : hasTokens ? (
        <WalletTabs />
      ) : (
        renderInfo('No tokens found')
      )}
    </View>
  );
}
