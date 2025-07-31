import { Wallet } from 'lucide-react-native';
import { View } from 'react-native';

import { cn, formatNumber } from '@/lib/utils';
import { Text } from '../ui/text';

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
        <Text className="text-2xl md:text-3xl font-semibold">${formatNumber(balance)}</Text>
        {/* <Image source={require('@/assets/images/eth-bitcoin-usdc-4x.png')} style={{ width: 78, height: 28 }} /> */}
      </View>
    </View>
  );
};

export default WalletCard;
