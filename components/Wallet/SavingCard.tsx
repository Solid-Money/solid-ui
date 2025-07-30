import { LinearGradient } from 'expo-linear-gradient';
import { Leaf } from 'lucide-react-native';
import { View } from 'react-native';

import { cn, formatNumber } from '@/lib/utils';
import { Text } from '../ui/text';

type SavingCardProps = {
  savings: number;
  className?: string;
};

const SavingCard = ({ savings, className }: SavingCardProps) => {
  return (
    <LinearGradient
      start={{ x: 0.5, y: 0 }}
      end={{ x: 0.5, y: 1 }}
      colors={['rgb(52, 10, 89)', 'rgba(40, 9, 67, 0.7)']}
      className={cn('bg-card rounded-twice p-6 justify-between w-full h-full', className)}
    >
      <View className="flex-row items-center gap-2 opacity-50">
        <Leaf size={18} />
        <Text className="text-lg font-semibold">Savings</Text>
      </View>

      <View className="flex-row justify-between items-center">
        <Text className="text-2xl md:text-3xl text-brand font-semibold">
          ${formatNumber(savings)}
        </Text>
        {/* <Image source={require('@/assets/images/bitcoin-usdc-4x.png')} style={{ width: 53, height: 28 }} /> */}
      </View>
    </LinearGradient>
  );
};

export default SavingCard;
