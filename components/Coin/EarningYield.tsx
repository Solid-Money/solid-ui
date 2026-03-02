import { useMemo } from 'react';
import { View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import Ping from '@/components/Ping';
import { Text } from '@/components/ui/text';
import { useMaxAPY } from '@/hooks/useAnalytics';
import { useWalletTokens } from '@/hooks/useWalletTokens';
import { TokenBalance, VaultType } from '@/lib/types';
import { cn, formatNumber, isSoFUSEToken, isWalletCardExcludedToken } from '@/lib/utils';

interface EarningYieldProps {
  token: TokenBalance | undefined;
  className?: string;
}

const EarningYield = ({ token, className }: EarningYieldProps) => {
  const { tokens } = useWalletTokens();

  const vault = useMemo(() => {
    if (!token?.contractAddress) return undefined;
    if (isSoFUSEToken(token.contractAddress)) return VaultType.FUSE;
    if (isWalletCardExcludedToken(token.contractAddress)) return VaultType.USDC; // soUSD
    return undefined;
  }, [token?.contractAddress]);

  const { maxAPY, isAPYsLoading } = useMaxAPY(vault);

  const hasYield = useMemo(() => {
    if (!token) return false;

    const relatedTokens = token.commonId
      ? tokens.filter(t => t.commonId === token.commonId)
      : tokens.filter(t => t.contractTickerSymbol === token.contractTickerSymbol);

    return relatedTokens.some(t => isWalletCardExcludedToken(t.contractAddress));
  }, [token, tokens]);

  if (!hasYield || isAPYsLoading || !maxAPY || maxAPY === 0) {
    return null;
  }

  return (
    <View className={cn('relative rounded-twice', className)}>
      <LinearGradient
        colors={['rgba(122, 84, 234, 1)', 'rgba(122, 84, 234, 0.5)']}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.6, y: 1 }}
        pointerEvents="none"
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 0,
          bottom: 0,
          zIndex: -1,
          opacity: 0.3,
          borderBottomLeftRadius: 20,
          borderBottomRightRadius: 20,
        }}
      />
      <View className="flex-row items-center justify-center gap-2 px-5 pb-4 pt-6">
        <Text className="text-base font-medium text-brand">
          Earning {formatNumber(maxAPY, 1, 1)}% yield
        </Text>
        <Ping />
      </View>
    </View>
  );
};

export default EarningYield;
