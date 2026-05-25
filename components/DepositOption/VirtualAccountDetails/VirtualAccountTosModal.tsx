import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { Check } from 'lucide-react-native';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { DEPOSIT_MODAL } from '@/constants/modals';
import {
  useCreateOnrampAutomation,
  useOnrampAutomation,
} from '@/hooks/useOnrampAutomation';
import { useDepositStore } from '@/store/useDepositStore';

const TOS_POINTS = [
  'A persistent virtual bank account will be issued in your name for ACH and Wire deposits.',
  'Incoming USD is converted to USDC by Rain and automatically deposited into the soUSD vault on your behalf.',
  'You agree to Rain Payments’ Terms of Service and Privacy Policy and confirm you are the account holder.',
  'Deposits are subject to ACH (cutoff 4:00 PM ET) and Wire (cutoff 5:45 PM ET) banking hours. Settlement may take 1–3 business days.',
];

export const VirtualAccountTosModal = () => {
  const setModal = useDepositStore(state => state.setModal);
  const { data: existingAutomation } = useOnrampAutomation();
  const createMutation = useCreateOnrampAutomation();
  const [agreed, setAgreed] = useState(false);

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
      <View className="items-center gap-2 px-2">
        <Text className="text-2xl font-bold text-white">Before you continue</Text>
        <Text className="text-center text-base text-gray-400">
          Review the terms of the Rain virtual bank account.
        </Text>
      </View>

      <View className="gap-3 rounded-2xl bg-[#1C1C1C] p-4">
        {TOS_POINTS.map(point => (
          <View key={point} className="flex-row items-start gap-3">
            <View className="mt-1 h-1.5 w-1.5 rounded-full bg-[#94F27F]" />
            <Text className="flex-1 text-sm leading-5 text-white">{point}</Text>
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
          I agree to the terms above and authorize Rain to issue a virtual bank account on my behalf.
        </Text>
      </Pressable>

      {createMutation.isError && (
        <Text className="text-center text-sm text-red-400">
          Something went wrong creating your bank account. Please try again.
        </Text>
      )}

      <Button
        className="mt-auto h-14 rounded-2xl sm:mt-8"
        style={{
          backgroundColor: agreed && !createMutation.isPending ? '#94F27F' : '#3A3A3A',
        }}
        disabled={!agreed || createMutation.isPending}
        onPress={handleAccept}
      >
        {createMutation.isPending ? (
          <ActivityIndicator color="#000" />
        ) : (
          <Text className="text-base font-bold text-black">Accept and continue</Text>
        )}
      </Button>
    </View>
  );
};
