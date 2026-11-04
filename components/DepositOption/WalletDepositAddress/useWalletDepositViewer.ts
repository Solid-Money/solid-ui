import { useMemo } from 'react';

import { useCardProvider } from '@/hooks/useCardProvider';
import { useDepositTokensAccess } from '@/hooks/useDepositTokensAccess';
import { useOfferedRhinoDepositAssets } from '@/hooks/useRhinoDepositAssets';

import { WalletDepositViewer } from './constants';

/**
 * Who the deposit screen is for, as its lists need it: the card issuer, which
 * decides EURC and where stablecoins go, whether the tokens still being rolled
 * out are offered (`useDepositTokensAccess`), and rhino.fi's routes, which
 * decide every row but Fuse's.
 */
export const useWalletDepositViewer = (): WalletDepositViewer => {
  const { provider } = useCardProvider();
  const { isEnabled: hasNewTokens } = useDepositTokensAccess();
  const { status, assets } = useOfferedRhinoDepositAssets();
  return useMemo(
    () => ({
      provider,
      hasNewTokens,
      // The state alone: the lists only read it, and a screen offering a retry
      // asks `useOfferedRhinoDepositAssets` for one.
      rhino: status === 'ready' ? { status, assets } : { status },
    }),
    [assets, hasNewTokens, provider, status],
  );
};
