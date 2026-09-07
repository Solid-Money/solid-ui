import { useEffect, useRef } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Check, XCircle } from 'lucide-react-native';

import { useBuyCryptoNavigation } from '@/components/BuyCrypto/Transfi/BuyCryptoNavigation';
import DepositStepper from '@/components/DepositStepper';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { DEPOSIT_MODAL } from '@/constants/modals';
import { path } from '@/constants/path';
import { TRACKING_EVENTS } from '@/constants/tracking-events';
import { useTransfiOrder } from '@/hooks/useTransfi';
import { track } from '@/lib/analytics';
import { DepositProgressRow } from '@/lib/utils/deposit-steps';
import { useTransfiStore } from '@/store/useTransfiStore';

const STEPS = [
  { key: 'received', label: 'Payment received' },
  { key: 'confirmed', label: 'Converting to USDC' },
  { key: 'depositing', label: 'USDC on its way' },
] as const;

const PHASE_ORDER: Record<string, number> = {
  pending_payment: 0,
  processing: 1,
  completed: 2,
  failed: -1,
};

export const TransfiOrderStatus = () => {
  const router = useRouter();
  const setModal = useBuyCryptoNavigation();
  const reset = useTransfiStore(state => state.reset);
  const orderId = useTransfiStore(state => state.orderId);
  const { data: order } = useTransfiOrder(orderId ?? undefined);

  const phase = order?.phase ?? 'pending_payment';
  const activeIndex = PHASE_ORDER[phase] ?? 0;
  const isFailed = phase === 'failed';
  const isCompleted = phase === 'completed';
  const progressRows: DepositProgressRow[] = STEPS.map((step, index) => ({
    ...step,
    state:
      isCompleted || index < activeIndex
        ? 'complete'
        : index === activeIndex
          ? 'active'
          : 'pending',
  }));

  // The order is polled, so the terminal event is fired once per screen rather
  // than on every poll that comes back in the same phase.
  const reportedRef = useRef(false);
  useEffect(() => {
    if (reportedRef.current || (!isCompleted && !isFailed)) return;
    reportedRef.current = true;
    track(
      isCompleted
        ? TRACKING_EVENTS.BUY_CRYPTO_ORDER_COMPLETED
        : TRACKING_EVENTS.BUY_CRYPTO_ORDER_FAILED,
      {
        order_id: orderId ?? undefined,
        usdc_amount: order?.usdcAmount ? Number(order.usdcAmount) : undefined,
        currency: order?.fiatCurrency,
        status: order?.status,
      },
    );
  }, [isCompleted, isFailed, order, orderId]);

  const close = () => {
    reset();
    setModal(DEPOSIT_MODAL.CLOSE);
  };

  if (isFailed) {
    return (
      <View className="flex-1 items-center justify-center gap-6 px-4">
        <View className="items-center justify-center rounded-full bg-card p-6">
          <XCircle size={48} color="#F87171" />
        </View>
        <View className="items-center gap-2">
          <Text className="text-center text-2xl font-bold text-primary">Payment failed</Text>
          <Text className="text-center text-base text-muted-foreground">
            Your purchase didn&apos;t go through. Any funds taken will be refunded by TransFi.
          </Text>
        </View>
        <Button className="mt-auto h-14 w-full rounded-2xl" variant="secondary" onPress={close}>
          <Text className="text-base font-bold text-primary">Close</Text>
        </Button>
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
          {isCompleted ? 'Purchase complete' : 'Processing your purchase'}
        </Text>
        {order ? (
          <Text className="text-center text-base text-muted-foreground">
            {order.usdcAmount} USDC
            {order.feeData?.depositAmount
              ? ` for ${order.feeData.depositAmount} ${order.fiatCurrency}`
              : ''}
          </Text>
        ) : null}
      </View>

      <DepositStepper rows={progressRows} />

      {order?.orderId ? (
        <Text className="px-1 text-xs text-muted-foreground">Order ID: {order.orderId}</Text>
      ) : null}

      <View className="mt-auto gap-3">
        {isCompleted ? (
          <Button
            className="h-14 rounded-2xl"
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
        <Button className="h-12 rounded-2xl" variant="ghost" onPress={close}>
          <Text className="text-base font-semibold text-muted-foreground">
            {isCompleted ? 'Done' : 'Close'}
          </Text>
        </Button>
      </View>
    </View>
  );
};

export default TransfiOrderStatus;
