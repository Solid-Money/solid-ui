import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';
import { Image } from 'expo-image';
import { Check } from 'lucide-react-native';

import { useBuyCryptoNavigation } from '@/components/BuyCrypto/Transfi/BuyCryptoNavigation';
import { Text } from '@/components/ui/text';
import { DEPOSIT_MODAL } from '@/constants/modals';
import { TRACKING_EVENTS } from '@/constants/tracking-events';
import { useTransfiPaymentMethods } from '@/hooks/useTransfi';
import { track } from '@/lib/analytics';
import { cn } from '@/lib/utils';
import { useTransfiStore } from '@/store/useTransfiStore';

/** Full-step payment-method picker for the selected currency. */
export const TransfiPaymentMethodSelector = () => {
  const setModal = useBuyCryptoNavigation();
  const currency = useTransfiStore(state => state.fiatCurrency);
  const paymentCode = useTransfiStore(state => state.paymentCode);
  const setPaymentCode = useTransfiStore(state => state.setPaymentCode);

  const { data: methods, isLoading } = useTransfiPaymentMethods(currency ?? undefined);
  const selectedPaymentCode = paymentCode || methods?.[0]?.paymentCode;

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
      <View className="flex-1 items-center justify-center rounded-[15px] bg-[#1C1C1C] py-10">
        <ActivityIndicator size="large" color="#94F27F" />
      </View>
    );
  }

  return (
    <ScrollView
      className="flex-1"
      contentContainerStyle={{ paddingBottom: 8 }}
      showsVerticalScrollIndicator={false}
    >
      <View className="overflow-hidden rounded-[15px] bg-[#1C1C1C]">
        {methods?.length ? (
          methods.map((method, index) => {
            const isSelected = method.paymentCode === selectedPaymentCode;

            return (
              <Pressable
                key={method.paymentCode}
                accessibilityRole="button"
                accessibilityLabel={`Select ${method.paymentName ?? method.paymentCode}`}
                accessibilityState={{ selected: isSelected }}
                className={cn(
                  'h-16 flex-row items-center justify-between px-4 active:bg-white/10 web:hover:bg-white/[0.06]',
                  index < methods.length - 1 && 'border-b border-white/10',
                  isSelected && 'bg-white/[0.06]',
                )}
                onPress={() => handleSelect(method.paymentCode)}
              >
                <View className="min-w-0 flex-1 flex-row items-center gap-3">
                  {method.logo ? (
                    <Image
                      source={{ uri: method.logo }}
                      style={{ width: 32, height: 32, borderRadius: 16 }}
                      contentFit="contain"
                    />
                  ) : (
                    <View className="h-8 w-8 rounded-full bg-white/10" />
                  )}
                  <Text className="flex-1 text-base font-semibold text-white" numberOfLines={1}>
                    {method.paymentName ?? method.paymentCode}
                  </Text>
                </View>
                {isSelected ? (
                  <View className="ml-3 h-6 w-6 items-center justify-center rounded-full bg-brand">
                    <Check size={15} color="#111111" strokeWidth={2.5} />
                  </View>
                ) : null}
              </Pressable>
            );
          })
        ) : (
          <View className="items-center px-6 py-10">
            <Text className="text-center text-sm font-medium text-white/50">
              No payment methods available for {currency ?? 'this currency'}
            </Text>
          </View>
        )}
      </View>
    </ScrollView>
  );
};

export default TransfiPaymentMethodSelector;
