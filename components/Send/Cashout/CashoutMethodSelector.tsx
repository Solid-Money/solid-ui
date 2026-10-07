import { ActivityIndicator, Pressable, View } from 'react-native';
import { Image } from 'expo-image';
import { ChevronRight, Landmark, Smartphone } from 'lucide-react-native';

import { Text } from '@/components/ui/text';
import { SEND_MODAL } from '@/constants/modals';
import { TRACKING_EVENTS } from '@/constants/tracking-events';
import { useTransfiCashoutPaymentMethods } from '@/hooks/useTransfiCashout';
import { track } from '@/lib/analytics';
import { initialPayoutValues } from '@/lib/payoutFields';
import { asTransfiError } from '@/lib/transfiErrors';
import { cn } from '@/lib/utils';
import { useCashoutStore } from '@/store/useCashoutStore';
import { useSendStore } from '@/store/useSendStore';

import type { TransfiCashoutPaymentMethod } from '@/lib/types';

const formatLimit = (value: number | undefined, currency: string) =>
  value == null ? undefined : `${value.toLocaleString()} ${currency}`;

/** Second cash-out step: where the money goes — a bank, a mobile wallet… */
export const CashoutMethodSelector = () => {
  const setModal = useSendStore(state => state.setModal);
  const currency = useCashoutStore(state => state.currency);
  const paymentCode = useCashoutStore(state => state.paymentCode);
  const setPaymentCode = useCashoutStore(state => state.setPaymentCode);
  const setPaymentDetails = useCashoutStore(state => state.setPaymentDetails);
  const { data: methods, isLoading, error } = useTransfiCashoutPaymentMethods(currency);

  const handleSelect = (method: TransfiCashoutPaymentMethod) => {
    track(TRACKING_EVENTS.CASH_OUT_METHOD_SELECTED, {
      currency,
      payment_code: method.paymentCode,
      payment_type: method.paymentType,
    });
    if (method.paymentCode !== paymentCode) {
      setPaymentCode(method.paymentCode);
      // Start from what the verified profile already tells us — the holder's
      // name, their address — so the user only types the account itself.
      setPaymentDetails(initialPayoutValues(method.fields));
    }
    setModal(SEND_MODAL.OPEN_CASHOUT_DETAILS);
  };

  if (isLoading) {
    return (
      <View className="items-center justify-center py-10">
        <ActivityIndicator size="large" color="#94F27F" />
      </View>
    );
  }

  if (error || !methods?.length) {
    return (
      <View className="items-center gap-2 rounded-2xl bg-card px-6 py-10">
        <Text className="text-center text-base font-semibold">No way to pay out in {currency}</Text>
        <Text className="text-center text-sm text-muted-foreground">
          {error
            ? asTransfiError(error).message
            : 'Our payment partner has no payout methods for this currency yet.'}
        </Text>
      </View>
    );
  }

  return (
    <View className="gap-4">
      <Text className="text-base font-medium opacity-70">Send to</Text>
      <View className="overflow-hidden rounded-2xl bg-card">
        {methods.map((method, index) => {
          const max = formatLimit(method.maxAmount, currency ?? '');
          const isWallet = method.paymentType === 'local_wallet';
          return (
            <Pressable
              key={method.paymentCode}
              accessibilityRole="button"
              accessibilityLabel={`Send to ${method.paymentName ?? method.paymentCode}`}
              className={cn(
                'min-h-16 flex-row items-center gap-3 px-4 py-3 active:bg-white/10 web:hover:bg-white/[0.06]',
                index < methods.length - 1 && 'border-b border-white/10',
                method.paymentCode === paymentCode && 'bg-white/[0.06]',
              )}
              onPress={() => handleSelect(method)}
            >
              {method.logo ? (
                <Image
                  source={{ uri: method.logo }}
                  style={{ width: 32, height: 32, borderRadius: 16 }}
                  contentFit="contain"
                />
              ) : (
                <View className="h-8 w-8 items-center justify-center rounded-full bg-white/10">
                  {isWallet ? (
                    <Smartphone size={16} color="white" />
                  ) : (
                    <Landmark size={16} color="white" />
                  )}
                </View>
              )}
              <View className="flex-1">
                <Text className="text-base font-semibold text-white" numberOfLines={1}>
                  {method.paymentName ?? method.paymentCode}
                </Text>
                <Text className="text-sm text-white/50">
                  {isWallet ? 'Mobile money' : 'Bank transfer'}
                  {max ? ` · up to ${max}` : ''}
                </Text>
              </View>
              <ChevronRight size={20} color="white" />
            </Pressable>
          );
        })}
      </View>
    </View>
  );
};

export default CashoutMethodSelector;
