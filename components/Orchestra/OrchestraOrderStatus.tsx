import { useEffect, useRef } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Check, Clock, XCircle } from 'lucide-react-native';

import DepositStepper from '@/components/DepositStepper';
import NeedHelp from '@/components/NeedHelp';
import { useOrchestraNavigation } from '@/components/Orchestra/OrchestraNavigation';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { DEPOSIT_MODAL } from '@/constants/modals';
import { path } from '@/constants/path';
import { TRACKING_EVENTS } from '@/constants/tracking-events';
import { useOrchestraConfig } from '@/hooks/useOrchestra';
import { useOrchestraOrderStream } from '@/hooks/useOrchestraOrderStream';
import { track } from '@/lib/analytics';
import { orchestraErrorFromCode } from '@/lib/orchestraErrors';
import { formatSmallestUnits } from '@/lib/orchestraFormat';
import { ORCHESTRA_FAILED_STATUSES } from '@/lib/types/orchestra';
import { DepositProgressRow } from '@/lib/utils/deposit-steps';
import { useOrchestraStore } from '@/store/useOrchestraStore';

import type { OrchestraStatus } from '@/lib/types/orchestra';

// Keys come from DepositProgressRow's union — the stepper is shared with the
// activity feed, and only the labels are ours.
const STEPS = [
  { key: 'received', label: 'Payment received' },
  { key: 'confirmed', label: 'Converting' },
  { key: 'depositing', label: 'On its way to your wallet' },
] as const;

/**
 * Orchestra's states collapsed onto the three the user is shown.
 *
 * `awaiting_approval` sits at the conversion step rather than getting a row of
 * its own: it covers both a ZeroConf offer and an operator hold, neither of
 * which the user can act on, and "under review" on a screen with no review
 * button reads as a dead end.
 */
const STEP_BY_STATUS: Record<OrchestraStatus, number> = {
  processing: 0,
  confirming: 0,
  awaiting_approval: 1,
  swapping: 1,
  bridging: 1,
  delivering: 2,
  refunding: 1,
  completed: 2,
  refunded: -1,
  failed: -1,
  expired: -1,
  unfulfilled: 0,
};

export const OrchestraOrderStatus = () => {
  const router = useRouter();
  const setModal = useOrchestraNavigation();
  const reset = useOrchestraStore(state => state.reset);
  const storedOrder = useOrchestraStore(state => state.order);
  const { data: config } = useOrchestraConfig();

  const { status, order, isUnreadable } = useOrchestraOrderStream(storedOrder?.orderId);

  // Before the Lightning payment is detected there is no order to read, so the
  // screen holds at "waiting for payment" rather than showing nothing.
  const effectiveStatus = status ?? 'processing';
  const isCompleted = effectiveStatus === 'completed';
  const isFailed = ORCHESTRA_FAILED_STATUSES.includes(effectiveStatus);
  const isRefunding = effectiveStatus === 'refunding';
  const isWaitingForPayment = order == null;

  const activeIndex = STEP_BY_STATUS[effectiveStatus] ?? 0;
  const progressRows: DepositProgressRow[] = STEPS.map((step, index) => ({
    ...step,
    state:
      isCompleted || index < activeIndex
        ? 'complete'
        : index === activeIndex
          ? 'active'
          : 'pending',
  }));

  const symbol = config?.assetDisplaySymbol ?? config?.destinationAsset ?? 'USDC';
  const delivered = formatSmallestUnits(
    order?.amountOut ?? storedOrder?.estimatedOut,
    config?.decimals,
  );

  // The status is streamed and polled, so the terminal event fires once per
  // screen rather than on every update that lands in the same state.
  const reportedRef = useRef(false);
  useEffect(() => {
    if (reportedRef.current || (!isCompleted && !isFailed)) return;
    reportedRef.current = true;
    track(
      isCompleted
        ? TRACKING_EVENTS.ORCHESTRA_ORDER_COMPLETED
        : TRACKING_EVENTS.ORCHESTRA_ORDER_FAILED,
      {
        order_id: storedOrder?.orderId,
        status: effectiveStatus,
        error_code: order?.errorCode,
      },
    );
  }, [isCompleted, isFailed, effectiveStatus, order?.errorCode, storedOrder?.orderId]);

  const close = () => {
    reset();
    setModal(DEPOSIT_MODAL.CLOSE);
  };

  /**
   * The order can't be read any more — the 24-hour read token lapsed, or the key
   * lost its scope. That is not a failed deposit, and the screen must not imply
   * one: a paid invoice is still being settled somewhere we can no longer see.
   * Without this branch the snapshot stays undefined and the screen sits on
   * "Waiting for your payment" indefinitely, telling someone whose money has
   * already left that nothing has happened.
   */
  if (isUnreadable && !isCompleted) {
    return (
      <View className="flex-1 items-center justify-center gap-6 px-4">
        <View className="items-center justify-center rounded-full bg-card p-6">
          <Clock size={48} color="#A1A1AA" />
        </View>
        <View className="items-center gap-2">
          <Text className="text-center text-2xl font-bold text-primary">
            We can&apos;t track this deposit
          </Text>
          <Text className="text-center text-base text-muted-foreground">
            If you paid the invoice, your deposit is still being processed and will appear in your
            wallet. Contact support with the order ID below if it doesn&apos;t arrive.
          </Text>
        </View>
        {storedOrder?.orderId ? (
          <Text className="text-center text-xs text-muted-foreground">
            Order ID: {storedOrder.orderId}
          </Text>
        ) : null}
        <View className="mt-auto w-full gap-3">
          <Button className="h-14 rounded-full" variant="secondary" onPress={close}>
            <Text className="text-base font-semibold text-white">Close</Text>
          </Button>
          <NeedHelp />
        </View>
      </View>
    );
  }

  if (isFailed) {
    // `refunded` is a failure for this screen's purposes — the deposit did not
    // arrive — but the money did come back, and saying so is the difference
    // between a scare and an inconvenience.
    const wasRefunded = effectiveStatus === 'refunded';
    const detail = order?.errorCode
      ? orchestraErrorFromCode(order.errorCode).message
      : wasRefunded
        ? 'Your payment has been returned.'
        : 'Your deposit didn’t go through.';

    return (
      <View className="flex-1 items-center justify-center gap-6 px-4">
        <View className="items-center justify-center rounded-full bg-card p-6">
          {effectiveStatus === 'expired' ? (
            <Clock size={48} color="#F87171" />
          ) : (
            <XCircle size={48} color="#F87171" />
          )}
        </View>
        <View className="items-center gap-2">
          <Text className="text-center text-2xl font-bold text-primary">
            {effectiveStatus === 'expired'
              ? 'Invoice expired'
              : wasRefunded
                ? 'Deposit refunded'
                : 'Deposit failed'}
          </Text>
          <Text className="text-center text-base text-muted-foreground">
            {effectiveStatus === 'expired'
              ? 'The invoice wasn’t paid in time. Nothing was charged — start again to get a new one.'
              : detail}
          </Text>
        </View>
        <View className="mt-auto w-full gap-3">
          <Button
            className="h-14 rounded-full"
            variant="brand"
            onPress={() => {
              reset();
              setModal(DEPOSIT_MODAL.OPEN_ORCHESTRA_AMOUNT);
            }}
          >
            <Text className="text-base font-bold text-primary-foreground">Start again</Text>
          </Button>
          <Button className="h-12 rounded-full" variant="ghost" onPress={close}>
            <Text className="text-base font-semibold text-muted-foreground">Close</Text>
          </Button>
        </View>
      </View>
    );
  }

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
            ? 'Deposit complete'
            : isRefunding
              ? 'Returning your payment'
              : isWaitingForPayment
                ? 'Waiting for your payment'
                : 'Processing your deposit'}
        </Text>
        <Text className="text-center text-base text-muted-foreground">
          {isCompleted && delivered
            ? `${delivered} ${symbol} is in your wallet`
            : isRefunding
              ? 'This deposit couldn’t be completed, so your payment is on its way back to you.'
              : isWaitingForPayment
                ? 'This updates as soon as your Lightning payment lands.'
                : `Your ${symbol} is on its way.`}
        </Text>
      </View>

      {/* The delivery ladder describes a deposit that is still heading for the
          wallet. A refund is going the other way, so it gets the sentence above
          and no progress bar pointing at an arrival that isn't coming. */}
      {isRefunding ? null : <DepositStepper rows={progressRows} />}

      {/* `unfulfilled` is not a failure: the deposit was never confirmed or was
          replaced, and a late payment can still resume the order — so the screen
          says so instead of showing an indefinite spinner with no explanation. */}
      {effectiveStatus === 'unfulfilled' ? (
        <Text className="px-1 text-xs text-muted-foreground">
          We haven&apos;t confirmed your payment yet. If it was sent, it can still settle over the
          next few hours and this will update.
        </Text>
      ) : null}

      {storedOrder?.orderId ? (
        <Text className="px-1 text-xs text-muted-foreground">Order ID: {storedOrder.orderId}</Text>
      ) : null}

      <View className="mt-auto gap-3">
        {isCompleted ? (
          <Button
            className="h-14 rounded-full"
            variant="brand"
            onPress={() => {
              reset();
              setModal(DEPOSIT_MODAL.CLOSE);
              router.push(path.ACTIVITY);
            }}
          >
            <Text className="text-base font-bold text-primary-foreground">View activity</Text>
          </Button>
        ) : null}
        <Button className="h-12 rounded-full" variant="ghost" onPress={close}>
          <Text className="text-base font-semibold text-muted-foreground">
            {isCompleted ? 'Done' : 'Close'}
          </Text>
        </Button>
      </View>
    </View>
  );
};

export default OrchestraOrderStatus;
