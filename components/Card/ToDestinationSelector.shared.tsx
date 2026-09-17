import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { ChevronDown, Wallet as WalletIcon } from 'lucide-react-native';

import { Text } from '@/components/ui/text';
import { CHAIN_NAMES } from '@/constants/chains';
import { CardCollateralTokenBalanceDto } from '@/lib/types';
import { formatNumber } from '@/lib/utils';
import { assetLabel, withdrawableAssetOptions } from '@/lib/utils/cardHelpers';
import { CardDepositSource } from '@/store/useCardDepositStore';

import type { ToDestinationProps } from './ToDestinationSelector.types';

/**
 * How an asset is named in the picker: its symbol, plus the chain when the same
 * symbol appears more than once.
 *
 * A card funded on two chains holds two assets called "USDC", and two identical
 * rows with different balances is a choice nobody can make. The chain is only
 * added where it disambiguates — on the common single-chain card it would be
 * noise on every row.
 */
const optionLabel = (
  asset: CardCollateralTokenBalanceDto,
  options: CardCollateralTokenBalanceDto[],
): string => {
  const label = assetLabel(asset);
  const isAmbiguous = options.some(other => other !== asset && assetLabel(other) === label);
  if (!isAmbiguous) return label;
  return `${label} · ${CHAIN_NAMES[asset.chainId] ?? `Chain ${asset.chainId}`}`;
};

/**
 * "To" on the withdraw-from-card screen: the wallet, and which collateral asset
 * the withdrawal draws from.
 *
 * ## Why this is one plain list rather than a dropdown menu
 *
 * The web build used to render this as a portalled dropdown menu over the sheet.
 * Inside the withdraw modal on a phone browser that combination did not work: the
 * menu covered the "Withdraw" button it was asking the user to press next, and
 * taps on its rows mostly went nowhere — a portalled menu layered over a modal is
 * two dismiss layers arguing over the same touch. A cardholder in the support
 * recording spent nine seconds tapping the asset they wanted, got no response,
 * and gave up with the screen still open. That is the whole of "withdraw is not
 * working".
 *
 * An in-flow list has neither problem, and it is what native has always rendered.
 * Both platforms now share this file, so a fix to the picker can no longer land on
 * one of them only.
 */
export default function ToDestinationSelector({
  onChange,
  tokenSymbol = 'USDC',
  assets,
  selectedTokenAddress,
  onSelectAsset,
}: ToDestinationProps) {
  const [isOpen, setIsOpen] = useState(false);

  const options = withdrawableAssetOptions(assets, selectedTokenAddress);
  const selected = options.find(
    asset => asset.tokenAddress.toLowerCase() === selectedTokenAddress?.toLowerCase(),
  );
  const triggerSymbol = selected ? optionLabel(selected, options) : tokenSymbol;

  return (
    <View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Withdraw to Wallet in ${triggerSymbol}`}
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
          {options.length ? (
            options.map(asset => (
              <Pressable
                key={`${asset.chainId}-${asset.tokenAddress}`}
                accessibilityRole="button"
                className="flex-row items-center justify-between px-4 py-3 active:opacity-70 web:hover:bg-accent/50"
                onPress={() => {
                  onChange(CardDepositSource.COLLATERAL);
                  onSelectAsset?.(asset);
                  setIsOpen(false);
                }}
              >
                <View className="flex-row items-center gap-2">
                  <WalletIcon color="#A1A1A1" size={20} />
                  <Text className="text-lg">Wallet</Text>
                  <Text className="text-sm text-muted-foreground">
                    {optionLabel(asset, options)}
                  </Text>
                </View>
                <Text className="text-sm text-muted-foreground">
                  ${formatNumber(asset.balanceUsd, 2, 2)}
                </Text>
              </Pressable>
            ))
          ) : (
            <Pressable
              accessibilityRole="button"
              className="flex-row items-center gap-2 px-4 py-3 active:opacity-70"
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
