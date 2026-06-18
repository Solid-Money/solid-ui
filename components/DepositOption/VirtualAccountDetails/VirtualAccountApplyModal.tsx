import { useCallback } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { Building2 } from 'lucide-react-native';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { DEPOSIT_MODAL } from '@/constants/modals';
import { path } from '@/constants/path';
import { useCardStatus } from '@/hooks/useCardStatus';
import { RainApplicationStatus } from '@/lib/types';
import { useDepositStore } from '@/store/useDepositStore';
import { useKycStore } from '@/store/useKycStore';

const BENEFITS = [
  'A persistent virtual bank account in your name for ACH and Wire deposits.',
  'Incoming USD is auto-converted to USDC and deposited as soUSD.',
  'No fees from Solid — settlement typically in 1–3 business days.',
];

export const VirtualAccountApplyModal = () => {
  const router = useRouter();
  const setModal = useDepositStore(state => state.setModal);
  const setKycFlow = useKycStore(state => state.setKycFlow);
  const { data: cardStatus } = useCardStatus();

  const handleApply = useCallback(() => {
    const rainStatus = cardStatus?.rainApplicationStatus;

    // Rain already approved — go straight to the VA terms of service.
    if (rainStatus === RainApplicationStatus.APPROVED) {
      setModal(DEPOSIT_MODAL.OPEN_VIRTUAL_ACCOUNT_TOS);
      return;
    }

    setKycFlow('va');
    setModal(DEPOSIT_MODAL.CLOSE);

    // Didit is already done and Rain just needs its external verification /
    // information step — land on the pending page, which surfaces the
    // "Complete verification" / "Provide information" CTA, instead of
    // restarting the already-approved Didit document flow.
    if (
      rainStatus === RainApplicationStatus.NEEDS_VERIFICATION ||
      rainStatus === RainApplicationStatus.NEEDS_INFORMATION
    ) {
      router.push(path.CARD_PENDING);
      return;
    }

    // No Rain application yet — start the Didit KYC gate.
    router.push(path.KYC);
  }, [cardStatus, router, setKycFlow, setModal]);

  return (
    <View className="flex-1 gap-4">
      <View className="items-center gap-3 px-2">
        <View className="h-16 w-16 items-center justify-center rounded-full bg-[#1C1C1C]">
          <Building2 size={28} color="#94F27F" />
        </View>
        <Text className="text-2xl font-bold text-white">Virtual Bank Account</Text>
        <Text className="text-center text-base text-gray-400">
          Get a US bank account in your name so you can deposit USD straight into soUSD.
        </Text>
      </View>

      <View className="gap-3 rounded-2xl bg-[#1C1C1C] p-4">
        {BENEFITS.map(item => (
          <View key={item} className="flex-row items-start gap-3">
            <View className="mt-1 h-1.5 w-1.5 rounded-full bg-[#94F27F]" />
            <Text className="flex-1 text-sm leading-5 text-white">{item}</Text>
          </View>
        ))}
      </View>

      <Button
        className="mt-auto h-14 rounded-2xl sm:mt-8"
        style={{ backgroundColor: '#94F27F' }}
        onPress={handleApply}
      >
        <Text className="text-base font-bold text-black">Apply for Virtual Account</Text>
      </Button>
    </View>
  );
};
