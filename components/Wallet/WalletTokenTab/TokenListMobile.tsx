import { useCallback } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { zeroAddress } from 'viem';

import { TokenBalance, TokenType } from '@/lib/types';

import TokenCard from './TokenCard';
import { TokenListProps } from './types';

const coinPageId = (token: TokenBalance) =>
  `${token.chainId}-${token.type === TokenType.NATIVE ? zeroAddress : token.contractAddress}`;

const TokenListMobile = ({ tokens }: TokenListProps) => {
  const router = useRouter();

  const handleTokenPress = useCallback(
    (token: TokenBalance) => {
      router.push(`/coins/${coinPageId(token)}`);
    },
    [router],
  );

  return (
    <View>
      {tokens.map(token => (
        <TokenCard
          key={`${coinPageId(token)}-${token.quoteRate ?? 0}`}
          token={token}
          onPress={() => handleTokenPress(token)}
        />
      ))}
    </View>
  );
};

export default TokenListMobile;
