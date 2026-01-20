import { TextInput, View } from 'react-native';

import TokenSelectorModal from '@/components/TokenSelector/TokenSelectorModal';
import Skeleton from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { compactNumberFormat } from '@/lib/utils';

interface TokenCardProps {
  amount: string;
  onAmountChange: (value: string) => void;
  balance: string;
  price: number | undefined;
}

const TokenCard = ({ amount, onAmountChange, balance, price }: TokenCardProps) => {
  return (
    <View className="flex flex-col gap-2 rounded-xl bg-card p-6 md:rounded-twice md:p-10">
      <Text className="text-lg font-medium opacity-40">Amount to deposit</Text>
      <View className="flex-row items-center justify-between gap-4">
        <TokenSelectorModal />
        <View className="flex flex-1 flex-col items-end">
          <TextInput
            keyboardType="decimal-pad"
            className="w-full text-right text-2xl font-semibold text-primary web:focus:outline-none md:text-5xl"
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
              <Skeleton className="h-5 w-20 rounded-md" />
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
          <Skeleton className="h-5 w-40 rounded-md" />
        )}
      </View>
    </View>
  );
};

export default TokenCard;
