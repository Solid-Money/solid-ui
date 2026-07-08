import { View } from 'react-native';
import { Check } from 'lucide-react-native';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { CREDIT_LINE_MODAL } from '@/constants/modals';
import { useCardDetails } from '@/hooks/useCardDetails';
import { formatNumber } from '@/lib/utils';
import { useCreditLineStore } from '@/store/useCreditLineStore';

import { NeedHelp } from './CreditLineShared';

/** Success screen shown after a borrow is submitted. */
export default function CreditLineSuccess() {
  const { data: cardDetails } = useCardDetails();
  const amount = useCreditLineStore(state => state.transaction.amount) ?? 0;
  const setModal = useCreditLineStore(state => state.setModal);

  const availableAmount = Number(cardDetails?.balances.available?.amount || '0');
  const newBalance = availableAmount + amount;

  return (
    <View className="flex-1 items-center gap-6 pt-4">
      <View className="h-24 w-24 items-center justify-center rounded-full border-2 border-white/30">
        <Check size={44} color="rgba(255,255,255,0.85)" />
      </View>

      <View className="items-center gap-3">
        <Text className="text-2xl font-semibold text-white">
          ${formatNumber(amount, 0)} is ready to spend
        </Text>
        <Text className="max-w-[311px] text-center text-base text-white/50">
          This may take up to 24H. We&apos;ll keep processing this in the background. You can safely
          leave this page.
        </Text>
      </View>

      <View className="w-full flex-row items-center justify-between rounded-2xl bg-[#1C1C1C] p-5">
        <Text className="text-base text-white/70">New spendable balance</Text>
        <Text className="text-base font-medium text-white">${formatNumber(newBalance, 2)}</Text>
      </View>

      <View className="flex-1" />

      <Button
        variant="brand"
        className="h-12 w-full rounded-2xl"
        onPress={() => setModal(CREDIT_LINE_MODAL.CLOSE)}
      >
        <Text className="native:text-lg text-base font-bold text-black">Back to card</Text>
      </Button>

      <NeedHelp />
    </View>
  );
}
