import React, { useCallback, useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';

import { WalletTokenSelectorScreen } from '@/components/WalletTokenSelector';
import { BRIDGE_TOKENS } from '@/constants/bridge';
import { DEPOSIT_MODAL } from '@/constants/modals';
import useVaultDepositConfig from '@/hooks/useVaultDepositConfig';
import { TokenBalance } from '@/lib/types';
import { useDepositStore } from '@/store/useDepositStore';

/**
 * Token selector for the Savings deposit flow (Step 2).
 * Thin wrapper around WalletTokenSelectorScreen that filters by the selected
 * vault's supported chains/symbols and navigates back to the deposit form.
 */
const SavingsDepositTokenSelector: React.FC = () => {
  const { setSrcChainId, setPrincipalToken, setModal } = useDepositStore(
    useShallow(state => ({
      setSrcChainId: state.setSrcChainId,
      setPrincipalToken: state.setPrincipalToken,
      setModal: state.setModal,
    })),
  );
  const { vault } = useVaultDepositConfig();

  const { supportedChainIds, supportedTokenSymbols } = useMemo(() => {
    const config = vault.depositConfig;
    return {
      supportedChainIds: config?.supportedChains ?? [],
      supportedTokenSymbols: config?.supportedTokens ?? [],
    };
  }, [vault]);

  const handleTokenSelect = useCallback(
    (token: TokenBalance) => {
      const symbol = token.contractTickerSymbol?.toUpperCase();
      const chainId = token.chainId;

      // Look up the token key in BRIDGE_TOKENS for this chain
      const bridgeTokens = BRIDGE_TOKENS[chainId]?.tokens;
      const tokenKey = bridgeTokens
        ? Object.keys(bridgeTokens).find(k => k.toUpperCase() === symbol)
        : undefined;

      setSrcChainId(chainId);
      setPrincipalToken(tokenKey || symbol || '');
      setModal(DEPOSIT_MODAL.OPEN_FORM);
    },
    [setSrcChainId, setPrincipalToken, setModal],
  );

  return (
    <WalletTokenSelectorScreen
      supportedChainIds={supportedChainIds}
      supportedTokenSymbols={supportedTokenSymbols}
      onSelect={handleTokenSelect}
      emptyMessage="No depositable tokens found"
      emptyDescription="Add funds to your wallet first, then come back to deposit into Savings."
    />
  );
};

export default SavingsDepositTokenSelector;
