import { useMemo } from 'react';
import { formatUnits } from 'viem';

import { useDimension } from '@/hooks/useDimension';
import { useWalletTokens } from '@/hooks/useWalletTokens';
import { TokenBalance } from '@/lib/types';
import { isSoUSDToken } from '@/lib/utils';

import TokenListDesktop from './TokenListDesktop';
import TokenListMobile from './TokenListMobile';

const WalletTokenTab = () => {
  const { isScreenMedium } = useDimension();
  const { unifiedTokens } = useWalletTokens();

  // Convert unified tokens to display format and sort by USD value (descending)
  const allTokens = useMemo(() => {
    const displayTokens: TokenBalance[] = unifiedTokens.map(unified => {
      // Use the first chain balance for navigation
      const primaryChainBalance =
        unified.chainBalances.find(b => !isSoUSDToken(b.contractAddress)) ||
        unified.chainBalances[0];

      return {
        ...unified,
        balance: unified.unifiedBalance,
        // Use primary chain's chainId and contractAddress for navigation
        chainId: primaryChainBalance.chainId,
        contractAddress: primaryChainBalance.contractAddress,
      };
    });

    return displayTokens.sort((a, b) => {
      const balanceA = Number(formatUnits(BigInt(a.balance || '0'), a.contractDecimals));
      const balanceUSD_A = balanceA * (a.quoteRate || 0);

      const balanceB = Number(formatUnits(BigInt(b.balance || '0'), b.contractDecimals));
      const balanceUSD_B = balanceB * (b.quoteRate || 0);

      return balanceUSD_B - balanceUSD_A; // Descending order
    });
  }, [unifiedTokens]);

  // Responsive layout: card-based for mobile, table for desktop
  if (!isScreenMedium) {
    return <TokenListMobile tokens={allTokens} />;
  }

  return <TokenListDesktop tokens={allTokens} />;
};

export default WalletTokenTab;
