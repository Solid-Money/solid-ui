import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { Image } from 'expo-image';
import { ChevronRight } from 'lucide-react-native';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { canSendFrom } from '@/components/WirexBankAccount/railPresentation';
import { WirexBankTransferModal } from '@/components/WirexBankAccount/WirexBankTransferModal';
import { SEND_MODAL } from '@/constants/modals';
import { useWirexBankOverview } from '@/hooks/useWirexBankAccounts';
import { getAsset } from '@/lib/assets';
import { WirexBankAccountType, WirexBankRailStatusDto } from '@/lib/types/wirex-bank';
import { useSendStore } from '@/store/useSendStore';

/** Reuse the existing outbound SEPA/ACH flow, without provisioning an account. */
export function SendBankTransfer({
  onTransferOpenChange,
}: {
  onTransferOpenChange: (open: boolean) => void;
}) {
  const { data, isLoading, isError, refetch } = useWirexBankOverview();
  const [selectedRail, setSelectedRail] = useState<WirexBankRailStatusDto | null>(null);
  const setModal = useSendStore(state => state.setModal);
  const rails = (data?.rails ?? []).filter(canSendFrom);

  useEffect(() => {
    onTransferOpenChange(!!selectedRail);
    return () => onTransferOpenChange(false);
  }, [onTransferOpenChange, selectedRail]);

  if (selectedRail) {
    return <WirexBankTransferModal rail={selectedRail} onClose={() => setSelectedRail(null)} />;
  }

  if (isLoading) {
    return <ActivityIndicator className="py-8" color="#94F27F" />;
  }

  if (!rails.length) {
    return (
      <View className="gap-6 py-4">
        <Text className="text-center text-[16px] leading-6 text-white/70">
          {isError
            ? 'We couldn’t load your bank transfer options. Please try again.'
            : 'Bank transfers are not enabled on your account yet. You can send crypto or use local payout if it’s available.'}
        </Text>
        <Button
          variant="secondary"
          onPress={() => (isError ? void refetch() : setModal(SEND_MODAL.OPEN_SEND_OPTIONS))}
        >
          <Text className="text-[16px] font-semibold">
            {isError ? 'Try again' : 'Back to Send'}
          </Text>
        </Button>
      </View>
    );
  }

  return (
    <View className="gap-4 web:[font-synthesis:none]">
      <Text className="text-[16px] text-white/70">Choose the currency to send</Text>
      {rails.map(rail => {
        const isEuro = rail.accountType === WirexBankAccountType.SEPA;
        return (
          <Pressable
            key={rail.accountType}
            accessibilityRole="button"
            accessibilityLabel={`Send ${rail.currency} by ${isEuro ? 'SEPA' : 'ACH'}`}
            className="flex-row items-center gap-3 rounded-2xl bg-card p-4 active:opacity-80"
            onPress={() => setSelectedRail(rail)}
          >
            <Image
              source={getAsset(isEuro ? 'images/send/eu.svg' : 'images/send/us.svg')}
              style={{ width: 30, height: 30 }}
            />
            <View className="flex-1 gap-1">
              <Text className="text-[16px] font-semibold">
                {rail.currency} by {isEuro ? 'SEPA' : 'ACH'}
              </Text>
              <Text className="text-[13px] text-white/55">Usually 1–3 business days</Text>
            </View>
            <ChevronRight size={20} color="white" />
          </Pressable>
        );
      })}
    </View>
  );
}
