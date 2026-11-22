import { useEffect, useRef } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { Check, Clock, XCircle } from 'lucide-react-native';

import DepositStepper from '@/components/DepositStepper';
import NeedHelp from '@/components/NeedHelp';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { useWalletTopUpNavigation } from '@/components/WalletTopUp/WalletTopUpNavigation';
import { DEPOSIT_MODAL } from '@/constants/modals';
import { TRACKING_EVENTS } from '@/constants/tracking-events';
import useUser from '@/hooks/useUser';
import { useWalletTopUpStatus } from '@/hooks/useWalletTopUp';
import { track } from '@/lib/analytics';
import { refreshAccountQueries } from '@/lib/refreshAccountQueries';
import { refreshWalletActivity } from '@/lib/refreshWalletActivity';
import {
  formatWalletTopUpTokenAmount,
  getWalletTopUpProgress,
  WALLET_TOPUP_METHOD_LABEL,
} from '@/lib/walletTopUp';
import { useWalletTopUpStore } from '@/store/useWalletTopUpStore';

/**
 * Last step: where the top-up is, read from our backend every few seconds until
 * it settles.
 *
 * A finished Pay sheet only means the card was charged. "Confirmed by Wirex"
 * turns on when Wirex completes the top-up, and "Added to your wallet" when our
 * payout of the same amount lands in the Safe on Base.
 */
export const WalletTopUpStatus = () => {
  const navigate = useWalletTopUpNavigation();
  const queryClient = useQueryClient();
  const { user } = useUser();

  const storedMethod = useWalletTopUpStore(state => state.method);
  const source = useWalletTopUpStore(state => state.source);
  const estimationId = useWalletTopUpStore(state => state.estimationId);
  const receipt = useWalletTopUpStore(state => state.receipt);
  const statusEntry = useWalletTopUpStore(state => state.statusEntry);
  const reset = useWalletTopUpStore(state => state.reset);
  const restart = useWalletTopUpStore(state => state.restart);

  const { data: topUp } = useWalletTopUpStatus(estimationId);
  const status = topUp?.status;
  const method = topUp?.paymentMethod ?? storedMethod;
  const label = WALLET_TOPUP_METHOD_LABEL[method];

  const isCompleted = status === 'completed';
  const isFailed = status === 'failed' || status === 'expired';
  const isInReview = status === 'review';

  const received = topUp
    ? formatWalletTopUpTokenAmount(topUp.amount, topUp.token)
    : receipt
      ? formatWalletTopUpTokenAmount(receipt.amount, receipt.currency)
      : null;

  // Polled, so the outcome is reported (and balances refreshed) once per screen.
  const reportedRef = useRef(false);
  useEffect(() => {
    if (reportedRef.current || !status || !(isCompleted || isFailed || isInReview)) return;
    reportedRef.current = true;
    const analytics = {
      estimation_id: estimationId,
      status,
      payment_method: method,
      source,
      amount: topUp ? Number(topUp.amount) : undefined,
      currency: topUp?.currency,
    };
    if (!isCompleted) {
      track(TRACKING_EVENTS.WALLET_TOPUP_FAILED, analytics);
      return;
    }
    track(TRACKING_EVENTS.WALLET_TOPUP_COMPLETED, analytics);
    // The payout is in the Safe: the wallet balance, what the card can spend and
    // the activity feed are all behind it now.
    if (user?.userId && user.safeAddress) {
      void refreshAccountQueries(queryClient, user.userId, user.safeAddress).catch(() => {});
      void refreshWalletActivity(user.userId, user.safeAddress).catch(() => {});
    }
  }, [
    estimationId,
    isCompleted,
    isFailed,
    isInReview,
    method,
    queryClient,
    source,
    status,
    topUp,
    user?.safeAddress,
    user?.userId,
  ]);

  const close = () => {
    reset();
    navigate(DEPOSIT_MODAL.CLOSE);
  };

  const startAgain = () => {
    restart();
    navigate(DEPOSIT_MODAL.OPEN_WALLET_TOPUP_AMOUNT);
  };

  if (isFailed) {
    const isExpired = status === 'expired';
    return (
      <View className="flex-1 items-center justify-center gap-6 px-4">
        <View className="items-center justify-center rounded-full bg-card p-6">
          {isExpired ? <Clock size={48} color="#F87171" /> : <XCircle size={48} color="#F87171" />}
        </View>
        <View className="items-center gap-2">
          <Text className="text-center text-2xl font-bold text-primary">
            {isExpired ? 'Price expired' : "Top-up didn't go through"}
          </Text>
          <Text className="text-center text-base text-muted-foreground">
            {isExpired
              ? 'Nothing was charged. Start again to get a new price.'
              : `${label} couldn't complete this top-up, so nothing was added to your wallet.`}
          </Text>
        </View>
        <View className="mt-auto w-full gap-3">
          <Button className="h-14 rounded-full" variant="brand" onPress={startAgain}>
            <Text className="text-base font-bold text-primary-foreground">Start again</Text>
          </Button>
          <Button className="h-12 rounded-full" variant="ghost" onPress={close}>
            <Text className="text-base font-semibold text-muted-foreground">Close</Text>
          </Button>
        </View>
      </View>
    );
  }

  if (isInReview) {
    return (
      <View className="flex-1 items-center justify-center gap-6 px-4">
        <View className="items-center justify-center rounded-full bg-card p-6">
          <Clock size={48} color="#A1A1AA" />
        </View>
        <View className="items-center gap-2">
          <Text className="text-center text-2xl font-bold text-primary">
            We&apos;re checking this top-up
          </Text>
          <Text className="text-center text-base text-muted-foreground">
            No action needed. It will show in your activity once it&apos;s done.
          </Text>
        </View>
        <View className="mt-auto w-full gap-3">
          <Button className="h-14 rounded-full" variant="brand" onPress={close}>
            <Text className="text-base font-bold text-primary-foreground">Done</Text>
          </Button>
          <NeedHelp />
        </View>
      </View>
    );
  }

  // Not read yet, or nothing recorded yet, after a checkout that could not say
  // whether the payment went through: don't claim it is on its way.
  const isChecking = statusEntry !== 'executed' && (!status || status === 'quoted');

  return (
    <View className="flex-1 gap-6">
      <View className="items-center gap-2 pt-2">
        {isCompleted ? (
          <View className="items-center justify-center rounded-full bg-card p-5">
            <Check size={40} color="#94F27F" />
          </View>
        ) : (
          <ActivityIndicator size="large" color="#94F27F" />
        )}
        <Text className="text-center text-2xl font-bold text-primary">
          {isCompleted
            ? 'Top-up complete'
            : isChecking
              ? 'Checking your top-up…'
              : 'Top-up on its way'}
        </Text>
        <Text className="text-center text-base text-muted-foreground">
          {isCompleted
            ? `${received ?? 'Your top-up'} is in your Solid wallet.`
            : isChecking
              ? 'This updates as soon as we know whether your payment went through.'
              : `${received ?? 'Your top-up'} is being added to your wallet. This usually takes about a minute.`}
        </Text>
      </View>

      <DepositStepper rows={getWalletTopUpProgress(status, method)} />

      <View className="mt-auto gap-3">
        <Button
          className="h-14 rounded-full"
          variant={isCompleted ? 'brand' : 'secondary'}
          onPress={close}
        >
          <Text
            className={
              isCompleted
                ? 'text-base font-bold text-primary-foreground'
                : 'text-base font-semibold text-white'
            }
          >
            Done
          </Text>
        </Button>
        <NeedHelp />
      </View>
    </View>
  );
};

export default WalletTopUpStatus;
