import { useMemo } from 'react';

import { useCardProvider } from '@/hooks/useCardProvider';
import { useDepositTokensAccess } from '@/hooks/useDepositTokensAccess';

import { WalletDepositViewer } from './constants';

/**
 * Who the deposit screen is for, as its lists need it: the card issuer, which
 * decides EURC and where stablecoins go, and whether the tokens still being
 * rolled out are offered (`useDepositTokensAccess`).
 */
export const useWalletDepositViewer = (): WalletDepositViewer => {
  const { provider } = useCardProvider();
  const { isEnabled: hasNewTokens } = useDepositTokensAccess();
  return useMemo(() => ({ provider, hasNewTokens }), [provider, hasNewTokens]);
};
