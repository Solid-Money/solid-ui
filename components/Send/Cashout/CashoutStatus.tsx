import { ActivityIndicator, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Check, XCircle } from 'lucide-react-native';

import DepositStepper from '@/components/DepositStepper';
import NeedHelp from '@/components/NeedHelp';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { SEND_MODAL } from '@/constants/modals';
import { path } from '@/constants/path';
import { useTransfiCashoutOrder } from '@/hooks/useTransfiCashout';
import { formatCashoutFiat } from '@/lib/cashoutFormat';
import { DepositProgressRow } from '@/lib/utils/deposit-steps';
import { useCashoutStore } from '@/store/useCashoutStore';
import { useSendStore } from '@/store/useSendStore';

// Keys are the stepper's own; only the labels are cash-out's.
const STEPS = [
  { key: 'received', label: 'USDC sent' },
  { key: 'confirmed', label: 'Received by TransFi' },
  { key: 'depositing', label: 'Payout on its way' },
] as const;

/**
 * After the USDC has gone: TransFi's progress, polled until it ends.
 *
 * The first step is complete as soon as this screen shows — the transfer is
 * on-chain — so the user is never looking at a spinner for a step they have
 * already done.
 */
export const CashoutStatus = () => {
  const router = useRouter();
  const setModal = useSendStore(state => state.setModal);
  const instructions = useCashoutStore(state => state.order);
  const reset = useCashoutStore(state => state.reset);
  const { data: order } = useTransfiCashoutOrder(instructions?.orderId);

  const phase = order?.phase ?? 'awaiting_deposit';
  const isCompleted = phase === 'completed';
  // Expired after we sent means TransFi never matched the transfer; failed
  // means the fiat leg didn't go through. Either way the USDC left the wallet,
  // so both need a person, not a retry button.
  const isStuck = phase === 'failed' || phase === 'expired';
  const activeIndex = isCompleted ? STEPS.length : phase === 'processing' ? 2 : 1;
  const rows: DepositProgressRow[] = STEPS.map((step, index) => ({
    ...step,
    state: index < activeIndex ? 'complete' : index === activeIndex ? 'active' : 'pending',
  }));

  const close = () => {
    reset();
    setModal(SEND_MODAL.CLOSE);
  };

  const amountLine = formatCashoutFiat(
    order?.fiatAmount ?? instructions?.fiatAmount,
    instructions?.fiatCurrency ?? order?.fiatCurrency ?? '',
  );

  if (isStuck) {
    return (
      <View className="items-center gap-6 px-2 py-4">
        <View className="items-center justify-center rounded-full bg-card p-6">
          <XCircle size={48} color="#F87171" />
        </View>
        <View className="items-center gap-2">
          <Text className="text-center text-2xl font-bold">Payout didn’t go through</Text>
          <Text className="text-center text-base text-muted-foreground">
            Your USDC was sent, but the payout to {instructions?.payoutLabel ?? 'your account'}{' '}
            couldn’t be completed. Contact support with the order ID below and we’ll sort it out.
          </Text>
          {order?.orderId ? (
            <Text className="text-xs text-muted-foreground">Order ID: {order.orderId}</Text>
          ) : null}
        </View>
        <NeedHelp />
        <Button className="h-12 w-full rounded-2xl" variant="secondary" onPress={close}>
          <Text className="text-base font-bold">Close</Text>
        </Button>
      </View>
    );
  }

  return (
    <View className="gap-6">
      <View className="items-center gap-2 pt-2">
        {isCompleted ? (
          <View className="items-center justify-center rounded-full bg-card p-5">
            <Check size={40} color="#94F27F" />
          </View>
        ) : (
          <ActivityIndicator size="large" color="#94F27F" />
        )}
        <Text className="text-center text-2xl font-bold">
          {isCompleted ? `${amountLine} sent` : `${amountLine} is on its way`}
        </Text>
        <Text className="text-center text-base text-muted-foreground">
          To {instructions?.payoutLabel ?? 'your account'}
        </Text>
      </View>

      <DepositStepper rows={rows} />

      {order?.orderId ? (
        <Text className="px-1 text-xs text-muted-foreground">Order ID: {order.orderId}</Text>
      ) : null}

      <View className="gap-3">
        <Button
          className="h-12 rounded-2xl"
          variant="secondary"
          onPress={() => {
            close();
            router.push(path.ACTIVITY);
          }}
        >
          <Text className="text-base font-bold">View in Activity</Text>
        </Button>
        <Button className="h-12 rounded-2xl" variant="brand" onPress={close}>
          <Text className="text-base font-bold text-black">Done</Text>
        </Button>
      </View>
    </View>
  );
};

export default CashoutStatus;
