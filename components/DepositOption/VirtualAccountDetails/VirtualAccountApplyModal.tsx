import { useCallback, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { Check, ChevronRight, Globe } from 'lucide-react-native';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { DEPOSIT_MODAL } from '@/constants/modals';
import { path } from '@/constants/path';
import { useCardStatus } from '@/hooks/useCardStatus';
import { checkVaAccess, getCountryFromIp } from '@/lib/api';
import { getAsset } from '@/lib/assets';
import { RainApplicationStatus } from '@/lib/types';
import { withRefreshToken } from '@/lib/utils';
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

  const [isChecking, setIsChecking] = useState(false);
  const [countryNotSupported, setCountryNotSupported] = useState(false);

  const proceed = useCallback(() => {
    const rainStatus = cardStatus?.rainApplicationStatus;

    if (rainStatus === RainApplicationStatus.APPROVED) {
      setModal(DEPOSIT_MODAL.OPEN_VIRTUAL_ACCOUNT_TOS);
      return;
    }

    setKycFlow('va');
    setModal(DEPOSIT_MODAL.CLOSE);

    if (
      rainStatus === RainApplicationStatus.NEEDS_VERIFICATION ||
      rainStatus === RainApplicationStatus.NEEDS_INFORMATION
    ) {
      router.push(path.CARD_PENDING);
      return;
    }

    router.push(path.KYC);
  }, [cardStatus, router, setKycFlow, setModal]);

  const handleApply = useCallback(async () => {
    setIsChecking(true);
    try {
      // Prefer the country from the completed KYC record; fall back to IP detection.
      const countryCode = cardStatus?.country ?? (await getCountryFromIp())?.countryCode;

      if (!countryCode) {
        // Can't determine country — let the KYC flow handle it.
        proceed();
        return;
      }

      const { hasAccess } = await withRefreshToken(() => checkVaAccess(countryCode));

      if (!hasAccess) {
        setCountryNotSupported(true);
        return;
      }

      proceed();
    } catch {
      // On any error, fall through and let the KYC flow surface the issue.
      proceed();
    } finally {
      setIsChecking(false);
    }
  }, [cardStatus, proceed]);

  if (countryNotSupported) {
    return (
      <View className="flex-1 items-center justify-center gap-6 px-4">
        <View className="items-center justify-center rounded-full bg-[#1C1C1C] p-6">
          <Globe size={48} color="rgba(255,255,255,0.4)" />
        </View>

        <View className="items-center gap-2">
          <Text className="text-center text-2xl font-bold text-white">
            Not Available in Your Region
          </Text>
          <Text className="text-center text-base text-[rgba(255,255,255,0.6)]">
            Virtual bank accounts are not yet available in your country. We&apos;re working on
            expanding access.
          </Text>
        </View>

        <Button
          className="mt-auto h-14 w-full rounded-2xl sm:mt-8"
          style={{ backgroundColor: '#1C1C1C' }}
          onPress={() => setModal(DEPOSIT_MODAL.CLOSE)}
        >
          <Text className="text-base font-bold text-white">Close</Text>
        </Button>
      </View>
    );
  }

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
        disabled={isChecking}
      >
        <Text className="text-base font-bold text-black">
          {isChecking ? 'Checking...' : 'Apply for a Virtual Account'}
        </Text>
      </Button>

      {/* More details link */}
      <Pressable className="flex-row items-center justify-center gap-1" onPress={() => {}}>
        <Text className="text-lg font-semibold text-white">More details</Text>
        <ChevronRight size={16} color="white" />
      </Pressable>
    </View>
  );
};
