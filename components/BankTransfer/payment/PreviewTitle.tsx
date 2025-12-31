import { getFiatIcon } from '@/components/BankTransfer/icons';
import { Text } from '@/components/ui/text';
import { View } from 'react-native';

type Props = {
  amount: string | undefined | null;
  currency: string | undefined | null; // expects lowercase like 'usd'
};

export function PreviewTitle({ amount, currency }: Props) {
  const FiatIcon = currency ? getFiatIcon(currency as any) : undefined;
  const upperCurrency = (currency || '').toUpperCase();

  return (
    <View className="items-center gap-1">
      <View className="flex-row items-center">
        <Text className="text-2xl font-bold text-white">Transfer </Text>
        {FiatIcon ? <FiatIcon width={22} height={22} /> : null}
        <Text className="ml-0.5 text-2xl font-bold text-white">
          {amount} {upperCurrency}{' '}
        </Text>
        <Text className="text-2xl font-bold text-muted-foreground">to</Text>
      </View>
      <Text className="text-2xl font-bold text-muted-foreground">this bank account</Text>
    </View>
  );
}
