import { useCallback } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';

import { TokenBalance } from '@/lib/types';

import TokenCard from './TokenCard';
import { TokenListProps } from './types';

const TokenListMobile = ({ tokens }: TokenListProps) => {
  const router = useRouter();

  const handleTokenPress = useCallback(
    (token: TokenBalance) => {
      router.push(`/coins/${token.chainId}-${token.contractAddress}`);
    },
    [router],
  );

  return (
    <View>
      {tokens.map(token => (
        <TokenCard
          key={`${token.chainId}-${token.contractAddress}`}
          token={token}
          onPress={() => handleTokenPress(token)}
        />
      ))}
    </View>
  );
};

export default TokenListMobile;
