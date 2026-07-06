import { useCallback } from 'react';
import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { Check, ChevronRight } from 'lucide-react-native';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { DEPOSIT_MODAL } from '@/constants/modals';
import { path } from '@/constants/path';
import { useCardStatus } from '@/hooks/useCardStatus';
import { RainApplicationStatus } from '@/lib/types';
import { getAsset } from '@/lib/assets';
import { useDepositStore } from '@/store/useDepositStore';
import { useKycStore } from '@/store/useKycStore';

const FLAG_SIZE = 88;
const FLAG_OVERLAP = 28;

const BENEFITS = [
  'A persistent virtual bank account in your name for ACH and Wire deposits.',
  'Incoming USD is auto-converted to USDC and deposited as soUSD.',
  'No fees from Solid – settlement typically in 1-3 business days.',
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
    <View className="flex-1 gap-6">
      {/* Flag icons */}
      <View className="items-center">
        <View
          style={{
            width: FLAG_SIZE * 2 - FLAG_OVERLAP,
            height: FLAG_SIZE,
            flexDirection: 'row',
          }}
        >
          <View
            style={{
              width: FLAG_SIZE,
              height: FLAG_SIZE,
              borderRadius: FLAG_SIZE / 2,
              overflow: 'hidden',
              borderWidth: 2,
              borderColor: '#101010',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 1,
            }}
          >
            <Image
              source={getAsset('images/us.png')}
              style={{ width: FLAG_SIZE, height: FLAG_SIZE }}
              contentFit="cover"
            />
          </View>
          <View
            style={{
              width: FLAG_SIZE,
              height: FLAG_SIZE,
              borderRadius: FLAG_SIZE / 2,
              overflow: 'hidden',
              borderWidth: 2,
              borderColor: '#101010',
              alignItems: 'center',
              justifyContent: 'center',
              marginLeft: -FLAG_OVERLAP,
              zIndex: 0,
            }}
          >
            <Image
              source={getAsset('images/eu.png')}
              style={{ width: FLAG_SIZE, height: FLAG_SIZE }}
              contentFit="cover"
            />
          </View>
        </View>
      </View>

      {/* Title + subtitle */}
      <View className="items-center gap-2 px-4">
        <Text className="text-center text-3xl font-bold text-white">Virtual Bank Account</Text>
        <Text className="text-center text-base text-[rgba(255,255,255,0.7)]">
          Get a US bank account in your name so you can deposit USD straight into soUSD.
        </Text>
      </View>

      {/* Benefits */}
      <View className="gap-4 rounded-2xl bg-[#1C1C1C] p-5">
        {BENEFITS.map(item => (
          <View key={item} className="flex-row items-start gap-3">
            <Check size={16} color="rgba(255,255,255,0.5)" style={{ marginTop: 2 }} />
            <Text className="flex-1 text-base leading-5 text-[rgba(255,255,255,0.7)]">{item}</Text>
          </View>
        ))}
      </View>

      {/* Apply button */}
      <Button
        className="mt-auto h-14 rounded-2xl sm:mt-8"
        style={{ backgroundColor: '#94F27F' }}
        onPress={handleApply}
      >
        <Text className="text-base font-bold text-black">Apply for a Virtual Account</Text>
      </Button>

      {/* More details link */}
      <Pressable className="flex-row items-center justify-center gap-1" onPress={() => {}}>
        <Text className="text-lg font-semibold text-white">More details</Text>
        <ChevronRight size={16} color="white" />
      </Pressable>
    </View>
  );
};
