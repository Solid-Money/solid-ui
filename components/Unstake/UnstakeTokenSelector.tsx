import React, { useCallback, useMemo } from 'react';
import { View } from 'react-native';
import { useShallow } from 'zustand/react/shallow';

import { WalletTokenList } from '@/components/WalletTokenSelector';
import { Text } from '@/components/ui/text';
import { UNSTAKE_MODAL } from '@/constants/modals';
import { isSolidTokenSymbol } from '@/constants/withdraw';
import { useWalletTokens } from '@/hooks/useWalletTokens';
import { TokenBalance } from '@/lib/types';
import { useUnstakeStore } from '@/store/useUnstakeStore';

const UnstakeTokenSelector: React.FC = () => {
  const { selectedToken, setSelectedToken, setModal } = useUnstakeStore(
    useShallow(state => ({
      selectedToken: state.selectedToken,
      setSelectedToken: state.setSelectedToken,
      setModal: state.setModal,
    })),
  );
  const { ethereumTokens, fuseTokens, baseTokens } = useWalletTokens();

  const vaultTokens = useMemo(() => {
    const allTokens = [...ethereumTokens, ...fuseTokens, ...baseTokens];
    return allTokens.filter(token => isSolidTokenSymbol(token.contractTickerSymbol));
  }, [ethereumTokens, fuseTokens, baseTokens]);

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
