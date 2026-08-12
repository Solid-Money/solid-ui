import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { XCircle } from 'lucide-react-native';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { DEPOSIT_MODAL } from '@/constants/modals';
import { useBuyCryptoKycRoute } from '@/hooks/useBuyCryptoKycRoute';
import { useShareTransfiKyc, useTransfiStatus } from '@/hooks/useTransfi';
import { useDepositStore } from '@/store/useDepositStore';

/**
 * How many times to auto-fire the share before giving the user a manual retry.
 * The share can fail transiently (TransFi 5xx), and the poll would otherwise
 * re-trigger it forever behind a spinner.
 */
const MAX_SHARE_ATTEMPTS = 3;

/**
 * Shown while TransFi verifies the shared identity. If the user still needs to
 * share (arrived here straight from the identity flow), we trigger the share
 * automatically. Polls the gating status and advances to the amount screen on
 * approval, or shows the rejection reason.
 */
export const TransfiKycPending = () => {
  const setModal = useDepositStore(state => state.setModal);
  const routeToKyc = useBuyCryptoKycRoute();
  const { data: status } = useTransfiStatus({ poll: true });
  const { mutate: share, isPending: isSharing } = useShareTransfiKyc();
  const attemptsRef = useRef(0);
  const [exhausted, setExhausted] = useState(false);

  // If we can share but haven't succeeded yet (e.g. just returned from the
  // identity flow), fire it. Self-limiting: the effect only re-runs while the
  // status is still can_share, and we stop after MAX_SHARE_ATTEMPTS.
  useEffect(() => {
    if (status?.status !== 'can_share' || isSharing) return;
    if (attemptsRef.current >= MAX_SHARE_ATTEMPTS) {
      setExhausted(true);
      return;
    }
    attemptsRef.current += 1;
    share();
  }, [status?.status, isSharing, share]);

  useEffect(() => {
    if (status?.status === 'ready') {
      setModal(DEPOSIT_MODAL.OPEN_BUY_CRYPTO_AMOUNT);
    }
  }, [status?.status, setModal]);

  // TransFi couldn't use the verification we shared — the user has to verify
  // again rather than wait on a decision that will never come.
  useEffect(() => {
    if (status?.status === 'needs_kyc') {
      void routeToKyc();
    }
  }, [status?.status, routeToKyc]);

  const handleRetry = useCallback(() => {
    attemptsRef.current = 0;
    setExhausted(false);
    share();
  }, [share]);

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

  if (exhausted) {
    return (
      <View className="flex-1 items-center justify-center gap-6 px-4">
        <View className="items-center gap-2">
          <Text className="text-center text-xl font-bold text-primary">
            We couldn&apos;t finish setting this up
          </Text>
          <Text className="text-center text-base text-muted-foreground">
            Sharing your verification with our payment partner didn&apos;t go through. Your identity
            check is still valid — try again in a moment.
          </Text>
        </View>
        <View className="mt-auto w-full gap-3">
          <Button className="h-14 rounded-2xl" variant="brand" onPress={handleRetry}>
            <Text className="text-base font-bold text-primary-foreground">Try again</Text>
          </Button>
          <Button
            className="h-12 rounded-2xl"
            variant="ghost"
            onPress={() => setModal(DEPOSIT_MODAL.CLOSE)}
          >
            <Text className="text-base font-semibold text-muted-foreground">Close</Text>
          </Button>
        </View>
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
