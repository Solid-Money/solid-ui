import { useMemo } from 'react';
import { View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { Text } from '@/components/ui/text';
import { useMaxAPY } from '@/hooks/useAnalytics';
import { useWalletTokens } from '@/hooks/useWalletTokens';
import { TokenBalance } from '@/lib/types';
import { cn, formatNumber, isSoUSDToken } from '@/lib/utils';
import Ping from '@/components/Ping';

interface EarningYieldProps {
  token: TokenBalance | undefined;
  className?: string;
}

const EarningYield = ({ token, className }: EarningYieldProps) => {
  const { tokens } = useWalletTokens();
  const { maxAPY, isAPYsLoading } = useMaxAPY();

  const hasYield = useMemo(() => {
    if (!token) return false;

    const relatedTokens = token.commonId
      ? tokens.filter(t => t.commonId === token.commonId)
      : tokens.filter(t => t.contractTickerSymbol === token.contractTickerSymbol);

    return relatedTokens.some(t => isSoUSDToken(t.contractAddress));
  }, [token, tokens]);

  if (!hasYield || isAPYsLoading || !maxAPY || maxAPY === 0) {
    return null;
  }

  return (
    <LinearGradient
      colors={['rgba(122, 84, 234, 0.3)', 'rgba(122, 84, 234, 0.2)']}
      start={{ x: 0.5, y: 0 }}
      end={{ x: 0.6, y: 1 }}
      className={cn('rounded-twice', className)}
    >
      <View className="flex-row items-center justify-center gap-2 px-5 pb-4 pt-6">
        <Text className="text-base font-medium text-brand">
          Earning {formatNumber(maxAPY, 1, 1)}% yield
        </Text>
        <Ping />
      </View>
    </LinearGradient>
  );
};

export default EarningYield;
