import { ReactNode, useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, View } from 'react-native';
import { BadgeCheck, Check } from 'lucide-react-native';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { Underline } from '@/components/ui/underline';
import { DEPOSIT_MODAL } from '@/constants/modals';
import { useCardStatus } from '@/hooks/useCardStatus';
import { useCreateOnrampAutomation, useOnrampAutomation } from '@/hooks/useOnrampAutomation';
import { RainApplicationStatus } from '@/lib/types';
import { useDepositStore } from '@/store/useDepositStore';

const underlineProps = {
  textClassName: 'text-sm font-bold text-white' as const,
  borderColor: 'rgba(255, 255, 255, 1)' as const,
};

const TOS_POINTS: { key: string; content: ReactNode }[] = [
  {
    key: 'issuance',
    content:
      'A persistent virtual bank account will be issued in your name for ACH and Wire deposits.',
  },
  {
    key: 'conversion',
    content:
      'Incoming USD is converted to USDC by Rain and automatically deposited into the soUSD vault on your behalf.',
  },
];

export const VirtualAccountTosModal = () => {
  const setModal = useDepositStore(state => state.setModal);
  const { data: existingAutomation } = useOnrampAutomation();
  const { data: cardStatus } = useCardStatus();
  const createMutation = useCreateOnrampAutomation();
  const [agreed, setAgreed] = useState(false);
  const isRainApproved = cardStatus?.rainApplicationStatus === RainApplicationStatus.APPROVED;

  // Defensive: if an automation already exists, skip ToS straight to details.
  useEffect(() => {
    if (existingAutomation) {
      setModal(DEPOSIT_MODAL.OPEN_VIRTUAL_ACCOUNT_DETAILS);
    }
  }, [existingAutomation, setModal]);

  const handleAccept = useCallback(() => {
    createMutation.mutate('ach', {
      onSuccess: () => {
        setModal(DEPOSIT_MODAL.OPEN_VIRTUAL_ACCOUNT_DETAILS);
      },
    });
  }, [createMutation, setModal]);

  return (
    <View className="flex-1 gap-4">
      {isRainApproved && (
        <View className="flex-row items-center gap-3 rounded-2xl bg-[#142A11] px-4 py-3">
          <BadgeCheck size={20} color="#94F27F" />
          <View className="flex-1">
            <Text className="text-sm font-bold text-[#94F27F]">You’re approved</Text>
            <Text className="text-xs leading-4 text-[#A5D89A]">
              Accept the terms below to issue your virtual bank account.
            </Text>
          </View>
        </View>
      )}

      <View className="items-center gap-2 px-2">
        <Text className="text-2xl font-bold text-white">Before you continue</Text>
        <Text className="text-center text-base text-gray-400">
          Review the terms of the Rain virtual bank account.
        </Text>
      </View>

      <View className="gap-3 rounded-2xl bg-[#1C1C1C] p-4">
        {TOS_POINTS.map(point => (
          <View key={point.key} className="flex-row items-start gap-3">
            <View className="mt-1 h-1.5 w-1.5 rounded-full bg-[#94F27F]" />
            <Text className="flex-1 text-sm leading-5 text-white">{point.content}</Text>
          </View>
        ))}
      </View>

      <Pressable
        className="flex-row items-start gap-3 rounded-2xl bg-[#1C1C1C] px-4 py-4"
        onPress={() => setAgreed(prev => !prev)}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: agreed }}
      >
        <View
          className={`mt-0.5 h-5 w-5 items-center justify-center rounded border ${
            agreed ? 'border-[#94F27F] bg-[#94F27F]' : 'border-gray-500 bg-transparent'
          }`}
        >
          {agreed && <Check size={14} color="#000" />}
        </View>
        <Text className="flex-1 text-sm leading-5 text-white">
          I accept the{' '}
          <Underline
            inline
            {...underlineProps}
            onPress={() =>
              Linking.openURL(
                'https://support.solid.xyz/en/articles/15324239-solid-virtual-account-user-terms-of-service',
              )
            }
          >
            Virtual Account User Terms of Service
          </Underline>
          .
        </Text>
      </Pressable>

      <Text className="text-xs leading-4 text-gray-400">
        Solid is a financial technology company, not a bank. Banking services are provided by SSB,
        Member FDIC. Funds deposited at SSB are eligible for FDIC insurance up to $250,000 per
        depositor, per insured bank, subject to applicable limitations and FDIC rules.
      </Text>

      {createMutation.isError && (
        <Text className="text-center text-sm text-red-400">
          Something went wrong creating your bank account. Please try again.
        </Text>
      )}

      <Button
        className="h-14 rounded-2xl"
        style={{
          backgroundColor: agreed && !createMutation.isPending ? '#94F27F' : '#3A3A3A',
        }}
        disabled={!agreed || createMutation.isPending}
        onPress={handleAccept}
      >
        {createMutation.isPending ? (
          <ActivityIndicator color="#000" />
        ) : (
          <Text className="text-base font-bold text-black">Get my Virtual Account</Text>
        )}
      </Button>
    </View>
  );
};
