import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';
import { Image } from 'expo-image';
import { Check } from 'lucide-react-native';

import { Text } from '@/components/ui/text';
import { DEPOSIT_MODAL } from '@/constants/modals';
import { TRACKING_EVENTS } from '@/constants/tracking-events';
import { useTransfiPaymentMethods } from '@/hooks/useTransfi';
import { track } from '@/lib/analytics';
import { useDepositStore } from '@/store/useDepositStore';
import { useTransfiStore } from '@/store/useTransfiStore';

/** Full-step payment-method picker for the selected currency. */
export const TransfiPaymentMethodSelector = () => {
  const setModal = useDepositStore(state => state.setModal);
  const currency = useTransfiStore(state => state.fiatCurrency);
  const paymentCode = useTransfiStore(state => state.paymentCode);
  const setPaymentCode = useTransfiStore(state => state.setPaymentCode);

  const { data: methods, isLoading } = useTransfiPaymentMethods(currency ?? undefined);

  const handleSelect = (code: string) => {
    track(TRACKING_EVENTS.BUY_CRYPTO_PAYMENT_METHOD_SELECTED, {
      payment_code: code,
      currency: currency ?? undefined,
    });
    setPaymentCode(code);
    setModal(DEPOSIT_MODAL.OPEN_BUY_CRYPTO_AMOUNT);
  };

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center py-10">
        <ActivityIndicator size="large" color="#94F27F" />
      </View>
    );
  }

  return (
    <ScrollView className="flex-1">
      {methods?.length ? (
        methods.map(m => (
          <Pressable
            key={m.paymentCode}
            className="flex-row items-center justify-between border-b border-border px-1 py-3.5"
            onPress={() => handleSelect(m.paymentCode)}
          >
            <View className="flex-row items-center gap-3">
              {m.logo ? (
                <Image
                  source={{ uri: m.logo }}
                  style={{ width: 28, height: 28 }}
                  contentFit="contain"
                />
              ) : (
                <View className="h-7 w-7 rounded-full bg-card" />
              )}
              <Text className="text-lg font-semibold text-primary">
                {m.paymentName ?? m.paymentCode}
              </Text>
            </View>
            {m.paymentCode === paymentCode ? <Check size={18} color="#94F27F" /> : null}
          </Pressable>
        ))
      ) : (
        <Text className="py-8 text-center text-sm text-muted-foreground">
          No payment methods available for {currency ?? 'this currency'}
        </Text>
      )}
    </ScrollView>
  );
};

export default TransfiPaymentMethodSelector;
