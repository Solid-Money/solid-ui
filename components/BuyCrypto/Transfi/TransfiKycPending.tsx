import { useEffect, useRef } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { XCircle } from 'lucide-react-native';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { DEPOSIT_MODAL } from '@/constants/modals';
import { useShareTransfiKyc, useTransfiStatus } from '@/hooks/useTransfi';
import { useDepositStore } from '@/store/useDepositStore';

/**
 * Shown while TransFi verifies the shared identity. If the user still needs to
 * share (arrived here straight from the Didit flow), we trigger the share once
 * on mount. Polls the gating status and advances to the amount screen on
 * approval, or shows the rejection reason.
 */
export const TransfiKycPending = () => {
  const setModal = useDepositStore(state => state.setModal);
  const { data: status } = useTransfiStatus({ poll: true });
  const { mutate: share } = useShareTransfiKyc();
  const sharedRef = useRef(false);

  // If we can share but haven't yet (e.g. returned from the Didit flow), do it once.
  useEffect(() => {
    if (status?.status === 'can_share' && !sharedRef.current) {
      sharedRef.current = true;
      share();
    }
  }, [status?.status, share]);

  useEffect(() => {
    if (status?.status === 'ready') {
      setModal(DEPOSIT_MODAL.OPEN_BUY_CRYPTO_AMOUNT);
    }
  }, [status?.status, setModal]);

  if (status?.status === 'rejected') {
    return (
      <View className="flex-1 items-center justify-center gap-6 px-4">
        <View className="items-center justify-center rounded-full bg-card p-6">
          <XCircle size={48} color="#F87171" />
        </View>
        <View className="items-center gap-2">
          <Text className="text-center text-2xl font-bold text-primary">
            Verification unsuccessful
          </Text>
          <Text className="text-center text-base text-muted-foreground">
            {status.reasons?.length
              ? status.reasons.join(', ')
              : 'We couldn’t verify your identity with our payment partner. Please try again later.'}
          </Text>
        </View>
        <Button
          className="mt-auto h-14 w-full rounded-2xl"
          variant="secondary"
          onPress={() => setModal(DEPOSIT_MODAL.CLOSE)}
        >
          <Text className="text-base font-bold text-primary">Close</Text>
        </Button>
      </View>
    );
  }

  return (
    <View className="flex-1 items-center justify-center gap-5 px-4">
      <ActivityIndicator size="large" color="#94F27F" />
      <View className="items-center gap-2">
        <Text className="text-center text-xl font-bold text-primary">Verifying your identity</Text>
        <Text className="text-center text-base text-muted-foreground">
          This usually takes under a minute. You can keep this open.
        </Text>
      </View>
    </View>
  );
};

export default TransfiKycPending;
