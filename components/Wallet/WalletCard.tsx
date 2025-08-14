import { Wallet } from 'lucide-react-native';
import { Pressable, View } from 'react-native';

import { Text } from '@/components/ui/text';
import { cn, formatNumber } from '@/lib/utils';
import TooltipPopover from '@/components/Tooltip';
import { TokenBalance } from '@/lib/types';
import { WalletCardIcons } from '.';

type WalletCardProps = {
  balance: number;
  className?: string;
  tokens: TokenBalance[];
};

const WalletCard = ({ balance, className, tokens }: WalletCardProps) => {
  return (
    <View className={cn('bg-card rounded-twice p-6 justify-between w-full h-full', className)}>
      <View className="flex-row items-center gap-2 opacity-50">
        <Wallet size={18} />
        <Text className="text-lg font-semibold">Wallet</Text>
      </View>

      <View className="flex-row justify-between items-center">
        <View className="flex-row items-center gap-2">
          <Text className="text-2xl md:text-3xl font-semibold">${formatNumber(balance)}</Text>
          <TooltipPopover text="Unstaked soUSD coin balance" />
        </View>
        <TooltipPopover
          trigger={
            <Pressable>
              <WalletCardIcons tokens={tokens} />
            </Pressable>
          }
          content={
            <Text className="max-w-64">
              Displaying top three tokens by balance. Wallet can contain any ERC-20 token in
              Ethereum and Fuse for Swap and Send.
            </Text>
          }
        />
      </View>
    </View>
  );
};

export default WalletCard;
