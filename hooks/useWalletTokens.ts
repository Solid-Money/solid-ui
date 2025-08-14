import { useEffect } from 'react';
import { Address } from 'viem';
import { fuse, mainnet } from 'viem/chains';
import { useBalance } from 'wagmi';

import { ADDRESSES } from '@/lib/config';
import { useBalances } from './useBalances';
import useUser from './useUser';

export const useWalletTokens = () => {
  const { user } = useUser();
  const { totalUSD, soUSDEthereum, soUSDFuse, ethereumTokens, fuseTokens, tokens, isLoading, refresh } = useBalances();
  const { data: usdcBalance } = useBalance({
    address: user?.safeAddress as Address,
    token: ADDRESSES.ethereum.usdc,
    chainId: mainnet.id,
  });
  const { data: soUSDBalance } = useBalance({
    address: user?.safeAddress as Address,
    token: ADDRESSES.fuse.vault,
    chainId: fuse.id,
  });

  useEffect(() => {
    refresh();
  }, [soUSDBalance, usdcBalance, refresh]);

  const hasTokens = ethereumTokens.length > 0 || fuseTokens.length > 0;

  const uniqueTokens = tokens.filter((token, index, self) =>
    index === self.findIndex((t) => t.contractTickerSymbol === token.contractTickerSymbol),
  );

  return {
    totalUSD,
    soUSDEthereum,
    soUSDFuse,
    ethereumTokens,
    fuseTokens,
    uniqueTokens,
    isLoading,
    hasTokens,
  };
};
