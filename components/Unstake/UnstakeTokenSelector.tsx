import React, { useCallback, useMemo } from 'react';
import { View } from 'react-native';
import { useShallow } from 'zustand/react/shallow';

import { Text } from '@/components/ui/text';
import { WalletTokenList } from '@/components/WalletTokenSelector';
import { UNSTAKE_MODAL } from '@/constants/modals';
import { getVaultKey, isSolidTokenSymbol } from '@/constants/withdraw';
import { useWalletTokens } from '@/hooks/useWalletTokens';
import { TokenBalance } from '@/lib/types';
import { useUnstakeStore } from '@/store/useUnstakeStore';

const UnstakeTokenSelector: React.FC = () => {
  const { selectedToken, selectedVault, setSelectedToken, setModal } = useUnstakeStore(
    useShallow(state => ({
      selectedToken: state.selectedToken,
      selectedVault: state.selectedVault,
      setSelectedToken: state.setSelectedToken,
      setModal: state.setModal,
    })),
  );
  const { ethereumTokens, fuseTokens, baseTokens } = useWalletTokens();

  // Scope the list to the vault the user is withdrawing so the picker only
  // switches network (e.g. soUSD on Fuse vs soUSD on Ethereum).
  const vaultTokens = useMemo(() => {
    const allTokens = [...ethereumTokens, ...fuseTokens, ...baseTokens];
    return allTokens.filter(token => {
      if (!isSolidTokenSymbol(token.contractTickerSymbol)) return false;
      if (selectedVault) return getVaultKey(token.contractTickerSymbol) === selectedVault;
      return true;
    });
  }, [ethereumTokens, fuseTokens, baseTokens, selectedVault]);

  const handleTokenSelect = useCallback(
    (token: TokenBalance) => {
      setSelectedToken(token);
      setModal(UNSTAKE_MODAL.OPEN_FORM);
    },
    [setSelectedToken, setModal],
  );

  return (
    <View className="gap-4">
      <Text className="text-base font-medium opacity-70">Select an asset</Text>
      <WalletTokenList
        tokens={vaultTokens}
        selectedToken={selectedToken}
        onSelect={handleTokenSelect}
      />
    </View>
  );
};

export default UnstakeTokenSelector;
