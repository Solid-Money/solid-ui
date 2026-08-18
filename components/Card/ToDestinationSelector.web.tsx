import { Pressable, View } from 'react-native';
import { ChevronDown, Wallet as WalletIcon } from 'lucide-react-native';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Text } from '@/components/ui/text';
import { CardCollateralTokenBalanceDto } from '@/lib/types';
import { formatNumber } from '@/lib/utils';
import { CardDepositSource } from '@/store/useCardDepositStore';

export type ToDestinationProps = {
  onChange: (value: CardDepositSource) => void;
  tokenSymbol?: string;
  /**
   * Collateral assets the card actually holds, richest first. A card funded in
   * USDT and one funded in USDC both back the same spending balance, but each
   * is withdrawn separately — so every asset has to be offered, not just the
   * one the app happens to default to.
   */
  assets?: CardCollateralTokenBalanceDto[];
  /** Address of the asset currently selected. */
  selectedTokenAddress?: string;
  onSelectAsset?: (asset: CardCollateralTokenBalanceDto) => void;
};

/** "USDC" when the chain answered `symbol()`, else a short address. */
export const assetLabel = (asset: CardCollateralTokenBalanceDto): string =>
  asset.symbol || `${asset.tokenAddress.slice(0, 6)}…${asset.tokenAddress.slice(-4)}`;

export default function ToDestinationSelector({
  onChange,
  tokenSymbol = 'USDC',
  assets,
  selectedTokenAddress,
  onSelectAsset,
}: ToDestinationProps) {
  const withdrawable = assets?.filter(asset => !asset.unavailableReason) ?? [];
  const selected = withdrawable.find(
    asset => asset.tokenAddress.toLowerCase() === selectedTokenAddress?.toLowerCase(),
  );
  const triggerSymbol = selected ? assetLabel(selected) : tokenSymbol;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Pressable className="flex-row items-center justify-between rounded-2xl bg-accent p-4">
          <View className="flex-row items-center gap-2">
            <WalletIcon color="#A1A1A1" size={24} />
            <Text className="text-lg font-semibold">Wallet</Text>
          </View>
          <View className="flex-row items-center gap-2">
            <Text className="text-sm text-muted-foreground">{triggerSymbol}</Text>
            <ChevronDown color="#A1A1A1" size={20} />
          </View>
        </Pressable>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="-mt-4 w-full min-w-[380px] rounded-b-2xl rounded-t-none border-0">
        {withdrawable.length ? (
          withdrawable.map(asset => (
            <DropdownMenuItem
              key={`${asset.chainId}-${asset.tokenAddress}`}
              onPress={() => {
                onChange(CardDepositSource.COLLATERAL);
                onSelectAsset?.(asset);
              }}
              className="flex-row items-center justify-between px-4 py-3 web:cursor-pointer"
            >
              <View className="flex-row items-center gap-2">
                <WalletIcon color="#A1A1A1" size={20} />
                <Text className="text-lg">Wallet</Text>
                <Text className="text-sm text-muted-foreground">{assetLabel(asset)}</Text>
              </View>
              <Text className="text-sm text-muted-foreground">
                ${formatNumber(asset.balanceUsd, 2, 2)}
              </Text>
            </DropdownMenuItem>
          ))
        ) : (
          <DropdownMenuItem
            onPress={() => onChange(CardDepositSource.COLLATERAL)}
            className="flex-row items-center gap-2 px-4 py-3 web:cursor-pointer"
          >
            <WalletIcon color="#A1A1A1" size={20} />
            <Text className="text-lg">Wallet</Text>
            <Text className="text-sm text-muted-foreground">{tokenSymbol}</Text>
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
