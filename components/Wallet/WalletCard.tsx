import { Wallet } from 'lucide-react-native';
import { Pressable, View } from 'react-native';
import { Image } from 'expo-image';

import { Text } from '@/components/ui/text';
import { cn, formatNumber } from '@/lib/utils';
import TooltipPopover from '@/components/Tooltip';

type WalletCardProps = {
  balance: number;
  className?: string;
};

const WalletCard = ({ balance, className }: WalletCardProps) => {
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
              <Image
                source={require('@/assets/images/eth-fuse-usdc-4x.png')}
                style={{ width: 78, height: 28 }}
              />
            </Pressable>
          }
          content={
            <Text className="max-w-64">
              Wallet can contain any ERC-20 token in Ethereum and Fuse for Swap and Send
            </Text>
          }
        />
      </View>
    </View>
  );
};

export default WalletCard;
