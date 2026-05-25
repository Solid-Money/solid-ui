import { useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Info } from 'lucide-react-native';

import CopyToClipboard from '@/components/CopyToClipboard';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { DEPOSIT_MODAL } from '@/constants/modals';
import { useOnrampAutomation } from '@/hooks/useOnrampAutomation';
import type { OnrampAutomationRail } from '@/lib/types';
import { useDepositStore } from '@/store/useDepositStore';

const TAB_CONFIG: { key: OnrampAutomationRail; label: string }[] = [
  { key: 'ach', label: 'ACH' },
  { key: 'wire', label: 'Wire' },
];

const RAIL_FOOTER: Record<OnrampAutomationRail, string> = {
  ach: 'ACH cutoff is 4:00 PM ET. Funds typically settle in 1–3 business days.',
  wire: 'Wire cutoff is 5:45 PM ET. Funds typically settle the same business day.',
};

const Row = ({
  label,
  value,
  withDivider = false,
}: {
  label: string;
  value: string;
  withDivider?: boolean;
}) => (
  <View>
    <View className="flex-row items-center justify-between gap-4 px-4 py-4">
      <Text className="text-base text-gray-400" numberOfLines={1}>
        {label}
      </Text>
      <View className="flex-1 flex-row items-center justify-end gap-2 overflow-hidden">
        <Text
          className="flex-1 text-right text-base font-medium text-white"
          numberOfLines={2}
          ellipsizeMode="tail"
        >
          {value}
        </Text>
        {value ? <CopyToClipboard text={value} /> : null}
      </View>
    </View>
    {withDivider && <View className="mx-4 h-[1px] bg-[#2C2C2C]" />}
  </View>
);

export const VirtualAccountDetailsModal = () => {
  const setModal = useDepositStore(state => state.setModal);
  const { data: automation, isLoading } = useOnrampAutomation();
  const [rail, setRail] = useState<OnrampAutomationRail>('ach');

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center py-16">
        <ActivityIndicator />
      </View>
    );
  }

  if (!automation) {
    return (
      <View className="flex-1 items-center justify-center gap-4 py-12">
        <Text className="text-base text-white">Could not load your bank details.</Text>
        <Button
          className="h-12 rounded-2xl px-6"
          onPress={() => setModal(DEPOSIT_MODAL.OPEN_VIRTUAL_ACCOUNT_TOS)}
        >
          <Text className="text-base font-bold text-black">Try again</Text>
        </Button>
      </View>
    );
  }

  const { depositAddress } = automation;

  return (
    <View className="flex-1 gap-4">
      <View className="items-center gap-2">
        <Text className="text-2xl font-bold text-white">Deposit USD</Text>
        <Text className="text-center text-base text-gray-400">
          Send a transfer from your bank — funds arrive as soUSD in your Solid balance.
        </Text>
      </View>

      <View className="mt-2 flex-row gap-2 rounded-2xl bg-[#1C1C1C] p-1">
        {TAB_CONFIG.map(tab => {
          const isActive = rail === tab.key;
          return (
            <Button
              key={tab.key}
              className={`h-10 flex-1 rounded-xl ${isActive ? 'bg-[#2C2C2C]' : 'bg-transparent'}`}
              onPress={() => setRail(tab.key)}
            >
              <Text
                className={`text-base font-medium ${isActive ? 'text-white' : 'text-gray-400'}`}
              >
                {tab.label}
              </Text>
            </Button>
          );
        })}
      </View>

      <View className="overflow-hidden rounded-2xl bg-[#1C1C1C]">
        <Row label="Beneficiary name" value={depositAddress.beneficiaryName} withDivider />
        <Row label="Beneficiary address" value={depositAddress.beneficiaryAddress} withDivider />
        <Row label="Bank name" value={depositAddress.beneficiaryBankName} withDivider />
        <Row label="Bank address" value={depositAddress.beneficiaryBankAddress} withDivider />
        <Row label="Account number" value={depositAddress.accountNumber} withDivider />
        <Row label="Routing number" value={depositAddress.routingNumber} />
      </View>

      <View className="flex-row items-start gap-3 rounded-2xl bg-[#1C1C1C] px-4 py-4">
        <Info size={20} color="#94F27F" />
        <Text className="flex-1 text-sm leading-5 text-gray-400">{RAIL_FOOTER[rail]}</Text>
      </View>

      <Button
        className="mt-auto h-14 rounded-2xl sm:mt-8"
        style={{ backgroundColor: '#94F27F' }}
        onPress={() => setModal(DEPOSIT_MODAL.CLOSE)}
      >
        <Text className="text-base font-bold text-black">Done</Text>
      </Button>
    </View>
  );
};
