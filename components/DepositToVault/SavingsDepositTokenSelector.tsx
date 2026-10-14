import React, { useCallback, useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';

import { WalletTokenSelectorScreen } from '@/components/WalletTokenSelector';
import { DEPOSIT_MODAL } from '@/constants/modals';
import useVaultDepositConfig from '@/hooks/useVaultDepositConfig';
import { TokenBalance } from '@/lib/types';
import { getAllowedTokensForChain } from '@/lib/vaults';
import { useDepositStore } from '@/store/useDepositStore';

/**
 * Token selector for the Savings deposit flow (Step 2).
 * Thin wrapper around WalletTokenSelectorScreen that filters by the selected
 * vault's supported chains/symbols and navigates back to the deposit form.
 */
const SavingsDepositTokenSelector: React.FC = () => {
  const { setSrcChainId, setPrincipalToken, setDepositSourceChosen, setModal } = useDepositStore(
    useShallow(state => ({
      setSrcChainId: state.setSrcChainId,
      setPrincipalToken: state.setPrincipalToken,
      setDepositSourceChosen: state.setDepositSourceChosen,
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

      // The vault's own key for this token on this chain — BRIDGE_TOKENS' casing,
      // or EURC for the soEURC vault, whose EURC is not in BRIDGE_TOKENS.
      const tokenKey = getAllowedTokensForChain(chainId, vault).find(
        k => k.toUpperCase() === symbol,
      );

      setSrcChainId(chainId);
      setPrincipalToken(tokenKey || symbol || '');
      // Keep the form from replacing the pick with the largest holding.
      setDepositSourceChosen(true);
      setModal(DEPOSIT_MODAL.OPEN_FORM);
    },
    [setSrcChainId, setPrincipalToken, setDepositSourceChosen, setModal, vault],
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
