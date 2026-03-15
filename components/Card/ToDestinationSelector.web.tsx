import { Pressable, View } from 'react-native';
import { ChevronDown, Wallet as WalletIcon } from 'lucide-react-native';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Text } from '@/components/ui/text';
import { CardDepositSource } from '@/store/useCardDepositStore';

export type ToDestinationProps = {
  onChange: (value: CardDepositSource) => void;
  tokenSymbol?: string;
};

export default function ToDestinationSelector({
  onChange,
  tokenSymbol = 'USDC',
}: ToDestinationProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Pressable className="flex-row items-center justify-between rounded-2xl bg-accent p-4">
          <View className="flex-row items-center gap-2">
            <WalletIcon color="#A1A1A1" size={24} />
            <Text className="text-lg font-semibold">Wallet</Text>
          </View>
          <View className="flex-row items-center gap-2">
            <Text className="text-sm text-muted-foreground">{tokenSymbol}</Text>
            <ChevronDown color="#A1A1A1" size={20} />
          </View>
        </Pressable>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="-mt-4 w-full min-w-[380px] rounded-b-2xl rounded-t-none border-0">
        <DropdownMenuItem
          onPress={() => onChange(CardDepositSource.COLLATERAL)}
          className="flex-row items-center gap-2 px-4 py-3 web:cursor-pointer"
        >
          <WalletIcon color="#A1A1A1" size={20} />
          <Text className="text-lg">Wallet</Text>
          <Text className="text-sm text-muted-foreground">{tokenSymbol}</Text>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
