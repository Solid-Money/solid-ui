import { useMemo } from 'react';
import { formatUnits } from 'viem';

import { useDimension } from '@/hooks/useDimension';
import { useWalletTokens } from '@/hooks/useWalletTokens';

import TokenListDesktop from './TokenListDesktop';
import TokenListMobile from './TokenListMobile';

const WalletTokenTab = () => {
  const { isScreenMedium } = useDimension();
  const { ethereumTokens, fuseTokens, baseTokens } = useWalletTokens();

  // Combine and sort tokens by USD value (descending)
  const allTokens = useMemo(() => {
    const combined = [...ethereumTokens, ...fuseTokens, ...baseTokens];
    return combined.sort((a, b) => {
      const balanceA = Number(formatUnits(BigInt(a.balance || '0'), a.contractDecimals));
      const balanceUSD_A = balanceA * (a.quoteRate || 0);

      const balanceB = Number(formatUnits(BigInt(b.balance || '0'), b.contractDecimals));
      const balanceUSD_B = balanceB * (b.quoteRate || 0);

      return balanceUSD_B - balanceUSD_A; // Descending order
    });
  }, [ethereumTokens, fuseTokens, baseTokens]);

  // Responsive layout: card-based for mobile, table for desktop
  if (!isScreenMedium) {
    return <TokenListMobile tokens={allTokens} />;
  }

  return <TokenListDesktop tokens={allTokens} />;
};

export default WalletTokenTab;
