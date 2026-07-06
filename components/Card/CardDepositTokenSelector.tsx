import React, { useCallback, useMemo } from 'react';
import { arbitrum, base, fuse, mainnet, polygon } from 'viem/chains';
import { useShallow } from 'zustand/react/shallow';

import { WalletTokenSelectorScreen } from '@/components/WalletTokenSelector';
import { CARD_DEPOSIT_MODAL } from '@/constants/modals';
import { TokenBalance } from '@/lib/types';
import { useCardDepositStore, CardDepositSource } from '@/store/useCardDepositStore';
import { useDepositStore } from '@/store/useDepositStore';

const SUPPORTED_CHAIN_IDS = [mainnet.id, polygon.id, base.id, arbitrum.id, fuse.id];
const SUPPORTED_TOKEN_SYMBOLS = ['USDC'];

/**
 * Token selector for the Card deposit "from wallet" flow. Reuses the
 * generalized WalletTokenSelectorScreen (same screen as Savings) filtered
 * to USDC across the five supported chains, and navigates back to the card
 * deposit internal form on selection.
 */
const CardDepositTokenSelector: React.FC = () => {
  const { setSrcChainId, setPrincipalToken } = useDepositStore(
    useShallow(state => ({
      setSrcChainId: state.setSrcChainId,
      setPrincipalToken: state.setPrincipalToken,
    })),
  );
  const { setModal, setSource } = useCardDepositStore(
    useShallow(state => ({
      setModal: state.setModal,
      setSource: state.setSource,
    })),
  );

  const handleTokenSelect = useCallback(
    (token: TokenBalance) => {
      setSrcChainId(token.chainId);
      setPrincipalToken(token.contractTickerSymbol?.toUpperCase() || 'USDC');
      setSource(CardDepositSource.WALLET);
      setModal(CARD_DEPOSIT_MODAL.OPEN_INTERNAL_FORM);
    },
    [setSrcChainId, setPrincipalToken, setSource, setModal],
  );

  const supportedChainIds = useMemo(() => SUPPORTED_CHAIN_IDS, []);
  const supportedTokenSymbols = useMemo(() => SUPPORTED_TOKEN_SYMBOLS, []);

  return (
    <WalletTokenSelectorScreen
      supportedChainIds={supportedChainIds}
      supportedTokenSymbols={supportedTokenSymbols}
      onSelect={handleTokenSelect}
      emptyMessage="No USDC found in your Solid wallet"
      emptyDescription="Add USDC to your Solid wallet on Ethereum, Polygon, Base, Arbitrum, or Fuse first, then come back to deposit to your card."
    />
  );
};

export default CardDepositTokenSelector;
