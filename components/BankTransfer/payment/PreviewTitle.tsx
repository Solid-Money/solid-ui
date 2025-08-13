import { Text } from '@/components/ui/text';
import { View } from 'react-native';
import { getFiatIcon } from '../icons';

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
        <Text className="text-white text-2xl font-bold">Transfer </Text>
        {FiatIcon ? <FiatIcon width={22} height={22} /> : null}
        <Text className="text-white text-2xl font-bold ml-0.5">
          {amount} {upperCurrency}{' '}
        </Text>
        <Text className="text-muted-foreground text-2xl font-bold">to</Text>
      </View>
      <Text className="text-muted-foreground text-2xl font-bold">this bank account</Text>
    </View>
  );
}
