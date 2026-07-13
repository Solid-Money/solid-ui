import React, { useCallback, useEffect } from 'react';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';
import { formatUnits } from 'viem';
import { useShallow } from 'zustand/react/shallow';

import RenderTokenIcon from '@/components/RenderTokenIcon';
import { Text } from '@/components/ui/text';
import { UNSTAKE_MODAL } from '@/constants/modals';
import { SavingsVault, useSavingsVaults } from '@/hooks/useSavingsVaults';
import getTokenIcon from '@/lib/getTokenIcon';
import { TokenBalance } from '@/lib/types';
import { formatNumber } from '@/lib/utils';
import { useUnstakeStore } from '@/store/useUnstakeStore';

/** Picks the highest-balance token within a vault to pre-select. */
const bestToken = (vault: SavingsVault): TokenBalance | undefined =>
  [...vault.tokens].sort((a, b) => {
    const aUSD =
      Number(formatUnits(BigInt(a.balance || '0'), a.contractDecimals)) * (a.quoteRate || 0);
    const bUSD =
      Number(formatUnits(BigInt(b.balance || '0'), b.contractDecimals)) * (b.quoteRate || 0);
    return bUSD - aUSD;
  })[0];

/**
 * First step of the withdraw flow when the user holds more than one savings
 * vault. Lists the vaults (soUSD / soFUSE / soETH) without any network detail.
 * When the user holds a single vault the screen auto-advances straight to the
 * form so it never flashes.
 */
const UnstakeVaultSelector: React.FC = () => {
  const { vaults, isLoading } = useSavingsVaults();
  const { setSelectedVault, setSelectedToken, setModal } = useUnstakeStore(
    useShallow(state => ({
      setSelectedVault: state.setSelectedVault,
      setSelectedToken: state.setSelectedToken,
      setModal: state.setModal,
    })),
  );

  const handleVaultSelect = useCallback(
    (vault: SavingsVault) => {
      setSelectedVault(vault.key);
      const token = bestToken(vault);
      if (token) setSelectedToken(token);
      setModal(UNSTAKE_MODAL.OPEN_FORM);
    },
    [setSelectedVault, setSelectedToken, setModal],
  );

  // Skip the picker entirely when there is nothing to choose between.
  useEffect(() => {
    if (isLoading) return;
    if (vaults.length === 1) handleVaultSelect(vaults[0]);
  }, [isLoading, vaults, handleVaultSelect]);

  if (isLoading || vaults.length === 1) {
    return (
      <View className="items-center justify-center py-16">
        <ActivityIndicator color="white" />
      </View>
    );
  }

  if (vaults.length === 0) {
    return (
      <View className="items-center justify-center gap-2 py-16">
        <Text className="text-lg font-medium text-muted-foreground">No savings to withdraw</Text>
      </View>
    );
  }

  return (
    <View className="gap-4">
      <Text className="text-base font-medium opacity-70">Select a vault</Text>
      <ScrollView className="md:h-[50vh]" showsVerticalScrollIndicator={false}>
        <View className="gap-2">
          {vaults.map(vault => (
            <Pressable
              key={vault.key}
              className="flex-row items-center justify-between rounded-2xl bg-card px-4 py-4 web:hover:bg-accent/50"
              onPress={() => handleVaultSelect(vault)}
            >
              <View className="flex-1 flex-row items-center gap-3">
                <RenderTokenIcon
                  tokenIcon={getTokenIcon({ tokenSymbol: vault.meta.iconSymbol, size: 40 })}
                  size={40}
                />
                <Text className="text-lg font-semibold">{vault.meta.displayName}</Text>
              </View>
              <Text className="text-lg font-semibold">${formatNumber(vault.balanceUSD, 2)}</Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </View>
  );
};

export default UnstakeVaultSelector;
