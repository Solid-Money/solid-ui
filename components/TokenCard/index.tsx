import { TextInput, View } from 'react-native';

import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { compactNumberFormat } from '@/lib/utils';
import TokenSelectorModal from '../TokenSelector/TokenSelectorModal';

interface TokenCardProps {
  amount: string;
  onAmountChange: (value: string) => void;
  balance: string;
  price: number | undefined;
}

const TokenCard = ({ amount, onAmountChange, balance, price }: TokenCardProps) => {
  return (
    <View className="flex flex-col gap-2 bg-card rounded-xl md:rounded-twice p-6 md:p-10">
      <Text className="text-lg font-medium opacity-40">Amount to deposit</Text>
      <View className="flex-row justify-between items-center gap-4">
        <TokenSelectorModal />
        <View className="flex flex-col flex-1 items-end">
          <TextInput
            keyboardType="decimal-pad"
            className="w-full text-right text-primary text-2xl md:text-5xl font-semibold web:focus:outline-none"
            value={amount}
            placeholder="0"
            onChangeText={onAmountChange}
          />
          <View className="flex self-end">
            {price ? (
              <Text className="text-sm font-medium opacity-40">
                ${compactNumberFormat(Number(amount) * price)}
              </Text>
            ) : (
              <Skeleton className="w-20 h-5 rounded-md" />
            )}
          </View>
        </View>
      </View>
      <View>
        {price ? (
          <Text className="text-sm font-medium opacity-40">
            Balance {balance} USDC (≈ ${compactNumberFormat(Number(balance) * price)})
          </Text>
        ) : (
          <Skeleton className="w-40 h-5 rounded-md" />
        )}
      </View>
    </View>
  );
};

export default TokenCard;
