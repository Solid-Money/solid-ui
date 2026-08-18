import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { ChevronDown, Wallet as WalletIcon } from 'lucide-react-native';

import { Text } from '@/components/ui/text';
import { formatNumber } from '@/lib/utils';
import { CardDepositSource } from '@/store/useCardDepositStore';

import { assetLabel, type ToDestinationProps } from './ToDestinationSelector.web';

export type { ToDestinationProps };

export default function ToDestinationSelector({
  onChange,
  tokenSymbol = 'USDC',
  assets,
  selectedTokenAddress,
  onSelectAsset,
}: ToDestinationProps) {
  const [isOpen, setIsOpen] = useState(false);

  const withdrawable = assets?.filter(asset => !asset.unavailableReason) ?? [];
  const selected = withdrawable.find(
    asset => asset.tokenAddress.toLowerCase() === selectedTokenAddress?.toLowerCase(),
  );
  const triggerSymbol = selected ? assetLabel(selected) : tokenSymbol;

  return (
    <View>
      <Pressable
        className="flex-row items-center justify-between rounded-2xl bg-accent p-4"
        onPress={() => setIsOpen(!isOpen)}
      >
        <View className="flex-row items-center gap-2">
          <WalletIcon color="#A1A1A1" size={24} />
          <Text className="text-lg font-semibold">Wallet</Text>
        </View>
        <View className="flex-row items-center gap-2">
          <Text className="text-sm text-muted-foreground">{triggerSymbol}</Text>
          <ChevronDown color="#A1A1A1" size={20} />
        </View>
      </Pressable>
      {isOpen && (
        <View className="mt-1 overflow-hidden rounded-2xl bg-accent">
          {withdrawable.length ? (
            withdrawable.map(asset => (
              <Pressable
                key={`${asset.chainId}-${asset.tokenAddress}`}
                className="flex-row items-center justify-between px-4 py-3"
                onPress={() => {
                  onChange(CardDepositSource.COLLATERAL);
                  onSelectAsset?.(asset);
                  setIsOpen(false);
                }}
              >
                <View className="flex-row items-center gap-2">
                  <WalletIcon color="#A1A1A1" size={20} />
                  <Text className="text-lg">Wallet</Text>
                  <Text className="text-sm text-muted-foreground">{assetLabel(asset)}</Text>
                </View>
                <Text className="text-sm text-muted-foreground">
                  ${formatNumber(asset.balanceUsd, 2, 2)}
                </Text>
              </Pressable>
            ))
          ) : (
            <Pressable
              className="flex-row items-center gap-2 px-4 py-3"
              onPress={() => {
                onChange(CardDepositSource.COLLATERAL);
                setIsOpen(false);
              }}
            >
              <WalletIcon color="#A1A1A1" size={20} />
              <Text className="text-lg">Wallet</Text>
              <Text className="text-sm text-muted-foreground">{tokenSymbol}</Text>
            </Pressable>
          )}
        </View>
      )}
    </View>
  );
}
