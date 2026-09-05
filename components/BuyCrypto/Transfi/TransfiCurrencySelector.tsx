import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, TextInput, View } from 'react-native';
import { Image } from 'expo-image';
import { Check, Search, X } from 'lucide-react-native';

import { useBuyCryptoNavigation } from '@/components/BuyCrypto/Transfi/BuyCryptoNavigation';
import { Text } from '@/components/ui/text';
import { DEPOSIT_MODAL } from '@/constants/modals';
import { TRACKING_EVENTS } from '@/constants/tracking-events';
import { useTransfiPaymentConfig } from '@/hooks/useTransfi';
import { track } from '@/lib/analytics';
import { cn } from '@/lib/utils';
import { useTransfiStore } from '@/store/useTransfiStore';

/** Full-step fiat currency picker (opened from the amount screen). */
export const TransfiCurrencySelector = () => {
  const setModal = useBuyCryptoNavigation();
  const currency = useTransfiStore(state => state.fiatCurrency);
  const setFiatCurrency = useTransfiStore(state => state.setFiatCurrency);
  const setPaymentCode = useTransfiStore(state => state.setPaymentCode);

  const { data: config, isLoading } = useTransfiPaymentConfig();
  const [query, setQuery] = useState('');

  const currencies = useMemo(() => {
    const list = config?.currencies ?? [];
    const q = query.trim().toUpperCase();
    return q ? list.filter(c => c.currency.toUpperCase().includes(q)) : list;
  }, [config?.currencies, query]);

  const handleSelect = (next: string) => {
    track(TRACKING_EVENTS.BUY_CRYPTO_CURRENCY_SELECTED, {
      currency: next,
      previous_currency: currency ?? undefined,
      searched: query.trim().length > 0,
    });
    setFiatCurrency(next);
    setPaymentCode(''); // methods differ per currency — reset the selection
    setModal(DEPOSIT_MODAL.OPEN_BUY_CRYPTO_AMOUNT);
  };

  return (
    <View className="flex-1 gap-5">
      <View className="h-[54px] flex-row items-center gap-3 rounded-[15px] bg-[#1C1C1C] px-4">
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
        {query ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Clear currency search"
            className="h-7 w-7 items-center justify-center rounded-full bg-white/10 active:opacity-70"
            onPress={() => setQuery('')}
          >
            <X size={15} color="rgba(255,255,255,0.7)" />
          </Pressable>
        ) : null}
      </View>

      {isLoading ? (
        <View className="flex-1 items-center justify-center rounded-[15px] bg-[#1C1C1C] py-10">
          <ActivityIndicator size="large" color="#94F27F" />
        </View>
      ) : (
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ paddingBottom: 8 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View className="overflow-hidden rounded-[15px] bg-[#1C1C1C]">
            {currencies.map((c, index) => {
              const isSelected = c.currency === currency;

              return (
                <Pressable
                  key={c.currency}
                  accessibilityRole="button"
                  accessibilityLabel={`Select ${c.currency}`}
                  accessibilityState={{ selected: isSelected }}
                  className={cn(
                    'h-16 flex-row items-center justify-between px-4 active:bg-white/10 web:hover:bg-white/[0.06]',
                    index < currencies.length - 1 && 'border-b border-white/10',
                    isSelected && 'bg-white/[0.06]',
                  )}
                  onPress={() => handleSelect(c.currency)}
                >
                  <View className="flex-row items-center gap-3">
                    {c.logoUrl ? (
                      <Image
                        source={{ uri: c.logoUrl }}
                        style={{ width: 32, height: 32, borderRadius: 16 }}
                        contentFit="contain"
                      />
                    ) : (
                      <View className="h-8 w-8 rounded-full bg-white/10" />
                    )}
                    <Text className="text-base font-semibold text-white">{c.currency}</Text>
                  </View>
                  {isSelected ? (
                    <View className="h-6 w-6 items-center justify-center rounded-full bg-brand">
                      <Check size={15} color="#111111" strokeWidth={2.5} />
                    </View>
                  ) : null}
                </Pressable>
              );
            })}
            {currencies.length === 0 ? (
              <View className="items-center px-6 py-10">
                <Text className="text-center text-sm font-medium text-white/50">
                  No currencies found
                </Text>
              </View>
            ) : null}
          </View>
        </ScrollView>
      )}
    </View>
  );
};

export default TransfiCurrencySelector;
