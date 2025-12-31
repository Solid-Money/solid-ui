import { PreviewTitle } from '@/components/BankTransfer/payment/PreviewTitle';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { path } from '@/constants/path';
import { SourceDepositInstructions } from '@/lib/types';
import { router, useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';

const Row = ({
  label,
  value,
  withDivider = false,
}: {
  label: string;
  value: string;
  withDivider?: boolean;
}) => (
  <View className={`px-6 py-6 ${withDivider ? 'border-b border-[#4E4E4E]' : ''}`}>
    <View className="flex-row items-center justify-between">
      <Text className="text-base font-bold text-muted-foreground">{label}</Text>
      <Text className="text-base font-bold text-white">{value}</Text>
    </View>
  </View>
);

export default function BankTransferPreviewScreen() {
  const { instructions } = useLocalSearchParams<{ instructions?: string }>();
  const data: SourceDepositInstructions | null = instructions ? JSON.parse(instructions) : null;

  return (
    <View className="flex-1 bg-background px-6 pb-6">
      <View className="w-full flex-1 gap-4 web:mx-auto web:max-w-3xl">
        <PreviewTitle amount={data?.amount} currency={data?.currency} />

        <View className="mt-6 overflow-hidden rounded-2xl bg-[#1C1C1C]">
          <Row
            label="Amount"
            value={`${data?.amount ?? ''} ${data?.currency?.toUpperCase() ?? ''}`}
            withDivider
          />
          <Row label="Bank Name" value={data?.bank_name ?? ''} withDivider />
          <Row label="Account number" value={data?.bank_account_number ?? ''} withDivider />
          <Row label="Routing / SWIFT / BIC" value={data?.bank_routing_number ?? ''} withDivider />
          <Row label="Beneficiary name" value={data?.bank_beneficiary_name ?? ''} />
        </View>

        <View className="overflow-hidden rounded-2xl bg-[#1C1C1C]">
          <Row label="Status" value={'Waiting for transfer'} />
        </View>
        <Button
          className="mt-auto h-14 rounded-2xl sm:mt-8"
          style={{ backgroundColor: '#94F27F' }}
          onPress={() => router.replace(path.ACTIVITY)}
        >
          <Text className="text-lg font-bold text-black">Done</Text>
        </Button>
      </View>
    </View>
  );
}
