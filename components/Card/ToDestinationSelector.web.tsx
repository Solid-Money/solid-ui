import { Pressable, View } from 'react-native';
import { ChevronDown, Landmark, Leaf, Wallet as WalletIcon } from 'lucide-react-native';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Text } from '@/components/ui/text';
import { CardDepositSource } from '@/store/useCardDepositStore';

export type ToDestinationProps = {
  value: CardDepositSource;
  onChange: (value: CardDepositSource) => void;
  showCollateralOption?: boolean;
};

export default function ToDestinationSelector({
  value,
  onChange,
  showCollateralOption,
}: ToDestinationProps) {
  const displayText =
    value === CardDepositSource.WALLET
      ? 'Wallet'
      : value === CardDepositSource.COLLATERAL
        ? 'Funding account'
        : 'Savings';
  const tokenLabel =
    value === CardDepositSource.WALLET
      ? 'USDC'
      : value === CardDepositSource.COLLATERAL
        ? 'USDC'
        : 'soUSD';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Pressable className="flex-row items-center justify-between rounded-2xl bg-accent p-4">
          <View className="flex-row items-center gap-2">
            {value === CardDepositSource.WALLET ? (
              <WalletIcon color="#A1A1A1" size={24} />
            ) : value === CardDepositSource.COLLATERAL ? (
              <Landmark color="#A1A1A1" size={24} />
            ) : (
              <Leaf color="#A1A1A1" size={24} />
            )}
            <Text className="text-lg font-semibold">{displayText}</Text>
          </View>
          <View className="flex-row items-center gap-2">
            <Text className="text-sm text-muted-foreground">{tokenLabel}</Text>
            <ChevronDown color="#A1A1A1" size={20} />
          </View>
        </Pressable>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="-mt-4 w-full min-w-[380px] rounded-b-2xl rounded-t-none border-0">
        <DropdownMenuItem
          onPress={() => onChange(CardDepositSource.SAVINGS)}
          className="flex-row items-center gap-2 px-4 py-3 web:cursor-pointer"
        >
          <Leaf color="#A1A1A1" size={20} />
          <Text className="text-lg">Savings</Text>
          <Text className="text-sm text-muted-foreground">soUSD</Text>
        </DropdownMenuItem>
        <DropdownMenuItem
          onPress={() => onChange(CardDepositSource.WALLET)}
          className="flex-row items-center gap-2 px-4 py-3 web:cursor-pointer"
        >
          <WalletIcon color="#A1A1A1" size={20} />
          <Text className="text-lg">Wallet</Text>
          <Text className="text-sm text-muted-foreground">USDC</Text>
        </DropdownMenuItem>
        {showCollateralOption && (
          <DropdownMenuItem
            onPress={() => onChange(CardDepositSource.COLLATERAL)}
            className="flex-row items-center gap-2 px-4 py-3 web:cursor-pointer"
          >
            <Landmark color="#A1A1A1" size={20} />
            <Text className="text-lg">Funding account</Text>
            <Text className="text-sm text-muted-foreground">USDC</Text>
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
