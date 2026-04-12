import React, { useCallback, useMemo } from 'react';
import { View } from 'react-native';
import { formatUnits } from 'viem';
import { useShallow } from 'zustand/react/shallow';

import { Text } from '@/components/ui/text';
import { WalletTokenList } from '@/components/WalletTokenSelector';
import { BRIDGE_TOKENS } from '@/constants/bridge';
import { DEPOSIT_MODAL } from '@/constants/modals';
import { VAULTS } from '@/constants/vaults';
import { useWalletTokens } from '@/hooks/useWalletTokens';
import { TokenBalance } from '@/lib/types';
import { useDepositStore } from '@/store/useDepositStore';
import { useSavingStore } from '@/store/useSavingStore';

/**
 * Token selector for the Savings deposit flow (Step 2).
 * Shows tokens from the user's Solid wallet that can be deposited into vaults,
 * with chain names displayed. Selecting a token sets the srcChainId, principalToken,
 * and appropriate vault, then navigates to the deposit form.
 */
const SavingsDepositTokenSelector: React.FC = () => {
  const { setSrcChainId, setPrincipalToken, setModal } = useDepositStore(
    useShallow(state => ({
      setSrcChainId: state.setSrcChainId,
      setPrincipalToken: state.setPrincipalToken,
      setModal: state.setModal,
    })),
  );
  const { selectVaultForDeposit } = useSavingStore();
  const { ethereumTokens, fuseTokens, polygonTokens, baseTokens, arbitrumTokens } =
    useWalletTokens();

  // Build a list of depositable tokens that match vault supported tokens
  const depositableTokens = useMemo(() => {
    const allTokens = [
      ...ethereumTokens,
      ...fuseTokens,
      ...polygonTokens,
      ...baseTokens,
      ...arbitrumTokens,
    ];

    // Collect all supported token symbols per chain from vault configs
    const supportedSet = new Set<string>();
    for (const vault of VAULTS) {
      const config = vault.depositConfig;
      if (!config) continue;
      for (const chainId of config.supportedChains) {
        for (const symbol of config.supportedTokens) {
          supportedSet.add(`${chainId}:${symbol.toUpperCase()}`);
        }
      }
    }

    return allTokens.filter(token => {
      const symbol = token.contractTickerSymbol?.toUpperCase();
      const key = `${token.chainId}:${symbol}`;
      if (!supportedSet.has(key)) return false;
      const balance = Number(formatUnits(BigInt(token.balance || '0'), token.contractDecimals));
      return balance > 0;
    });
  }, [ethereumTokens, fuseTokens, polygonTokens, baseTokens, arbitrumTokens]);

  const handleTokenSelect = useCallback(
    (token: TokenBalance) => {
      const symbol = token.contractTickerSymbol?.toUpperCase();
      const chainId = token.chainId;

      // Find the matching vault for this token
      const vaultIndex = VAULTS.findIndex(
        v =>
          v.depositConfig?.supportedTokens.some(s => s.toUpperCase() === symbol) &&
          v.depositConfig?.supportedChains.includes(chainId),
      );
      if (vaultIndex !== -1) {
        selectVaultForDeposit(vaultIndex);
      }

      // Look up the token key in BRIDGE_TOKENS for this chain
      const bridgeTokens = BRIDGE_TOKENS[chainId]?.tokens;
      const tokenKey = bridgeTokens
        ? Object.keys(bridgeTokens).find(k => k.toUpperCase() === symbol)
        : undefined;

      setSrcChainId(chainId);
      setPrincipalToken(tokenKey || symbol);
      setModal(DEPOSIT_MODAL.OPEN_FORM);
    },
    [setSrcChainId, setPrincipalToken, setModal, selectVaultForDeposit],
  );

  return (
    <View className="gap-4">
      <Text className="text-base font-medium opacity-70">
        Select a token from your wallet to deposit
      </Text>
      <WalletTokenList
        tokens={depositableTokens}
        onSelect={handleTokenSelect}
        emptyMessage="No depositable tokens found"
        emptyDescription="Add funds to your wallet first, then come back to deposit into Savings."
      />
    </View>
  );
};

export default SavingsDepositTokenSelector;
