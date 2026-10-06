import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, TextInput, View } from 'react-native';
import { Image } from 'expo-image';
import { Check, Search } from 'lucide-react-native';

import { Text } from '@/components/ui/text';
import { SEND_MODAL } from '@/constants/modals';
import { TRACKING_EVENTS } from '@/constants/tracking-events';
import { useTransfiCashoutConfig } from '@/hooks/useTransfiCashout';
import { track } from '@/lib/analytics';
import { asTransfiError } from '@/lib/transfiErrors';
import { cn } from '@/lib/utils';
import { useCashoutStore } from '@/store/useCashoutStore';
import { useSendStore } from '@/store/useSendStore';

/** First cash-out step: the currency to be paid out in. */
export const CashoutCurrencySelector = () => {
  const setModal = useSendStore(state => state.setModal);
  const currency = useCashoutStore(state => state.currency);
  const setCurrency = useCashoutStore(state => state.setCurrency);
  const { data: config, isLoading, error } = useTransfiCashoutConfig();
  const [query, setQuery] = useState('');

  // The user's own currency first, so the common choice is the first row.
  const currencies = useMemo(() => {
    const list = [...(config?.currencies ?? [])].sort((a, b) =>
      a.currency === config?.defaultCurrency ? -1 : b.currency === config?.defaultCurrency ? 1 : 0,
    );
    const q = query.trim().toUpperCase();
    return q ? list.filter(c => c.currency.toUpperCase().includes(q)) : list;
  }, [config?.currencies, config?.defaultCurrency, query]);

  const handleSelect = (next: string) => {
    track(TRACKING_EVENTS.CASH_OUT_CURRENCY_SELECTED, { currency: next });
    // Picking the same currency again keeps what was already typed for it.
    if (next !== currency) setCurrency(next);
    setModal(SEND_MODAL.OPEN_CASHOUT_METHOD);
  };

  if (isLoading) {
    return (
      <View className="items-center justify-center py-10">
        <ActivityIndicator size="large" color="#94F27F" />
      </View>
    );
  }

  if (error) {
    return (
      <View className="items-center gap-2 rounded-2xl bg-card px-6 py-10">
        <Text className="text-center text-base font-semibold">Cash-out isn’t available</Text>
        <Text className="text-center text-sm text-muted-foreground">
          {asTransfiError(error).message}
        </Text>
      </View>
    );
  }

  return (
    <View className="gap-4">
      <Text className="text-base font-medium opacity-70">Get paid in</Text>
      <View className="h-[54px] flex-row items-center gap-3 rounded-2xl bg-card px-4">
        <Search size={20} color="rgba(255,255,255,0.5)" />
        <TextInput
          accessibilityLabel="Search currencies"
          value={query}
          onChangeText={setQuery}
          placeholder="Search currency"
          placeholderTextColor="rgba(255,255,255,0.4)"
          autoCapitalize="characters"
          autoCorrect={false}
          className="flex-1 p-0 text-base font-medium text-white web:outline-none"
        />
      </View>
      <ScrollView className="max-h-[50vh]" showsVerticalScrollIndicator={false}>
        <View className="overflow-hidden rounded-2xl bg-card">
          {currencies.length ? (
            currencies.map((option, index) => {
              const isSelected = option.currency === currency;
              return (
                <Pressable
                  key={option.currency}
                  accessibilityRole="button"
                  accessibilityLabel={`Get paid in ${option.currency}`}
                  accessibilityState={{ selected: isSelected }}
                  className={cn(
                    'h-16 flex-row items-center justify-between px-4 active:bg-white/10 web:hover:bg-white/[0.06]',
                    index < currencies.length - 1 && 'border-b border-white/10',
                  )}
                  onPress={() => handleSelect(option.currency)}
                >
                  <View className="flex-row items-center gap-3">
                    {option.logoUrl ? (
                      <Image
                        source={{ uri: option.logoUrl }}
                        style={{ width: 32, height: 32, borderRadius: 16 }}
                        contentFit="cover"
                      />
                    ) : (
                      <View className="h-8 w-8 rounded-full bg-white/10" />
                    )}
                    <Text className="text-base font-semibold text-white">{option.currency}</Text>
                  </View>
                  {isSelected ? (
                    <View className="h-6 w-6 items-center justify-center rounded-full bg-brand">
                      <Check size={15} color="#111111" strokeWidth={2.5} />
                    </View>
                  ) : null}
                </Pressable>
              );
            })
          ) : (
            <View className="items-center px-6 py-10">
              <Text className="text-center text-sm font-medium text-white/50">
                {query.trim() ? 'No matching currency' : 'No payout currencies available'}
              </Text>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
};

export default CashoutCurrencySelector;
