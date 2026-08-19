import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, TextInput, View } from 'react-native';
import { Image } from 'expo-image';
import { Check, Search } from 'lucide-react-native';

import { Text } from '@/components/ui/text';
import { DEPOSIT_MODAL } from '@/constants/modals';
import { TRACKING_EVENTS } from '@/constants/tracking-events';
import { useTransfiPaymentConfig } from '@/hooks/useTransfi';
import { track } from '@/lib/analytics';
import { useDepositStore } from '@/store/useDepositStore';
import { useTransfiStore } from '@/store/useTransfiStore';

/** Full-step fiat currency picker (opened from the amount screen). */
export const TransfiCurrencySelector = () => {
  const setModal = useDepositStore(state => state.setModal);
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
    <View className="flex-1 gap-3">
      <View className="flex-row items-center gap-2 rounded-2xl bg-card px-4 py-3">
        <Search size={18} color="#9CA3AF" />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search currency"
          placeholderTextColor="#6B7280"
          autoCapitalize="characters"
          className="flex-1 text-base text-primary"
        />
      </View>

      {isLoading ? (
        <View className="flex-1 items-center justify-center py-10">
          <ActivityIndicator size="large" color="#94F27F" />
        </View>
      ) : (
        <ScrollView className="flex-1">
          {currencies.map(c => (
            <Pressable
              key={c.currency}
              className="flex-row items-center justify-between border-b border-border px-1 py-3.5"
              onPress={() => handleSelect(c.currency)}
            >
              <View className="flex-row items-center gap-3">
                {c.logoUrl ? (
                  <Image
                    source={{ uri: c.logoUrl }}
                    style={{ width: 28, height: 28, borderRadius: 14 }}
                    contentFit="contain"
                  />
                ) : (
                  <View className="h-7 w-7 rounded-full bg-card" />
                )}
                <Text className="text-lg font-semibold text-primary">{c.currency}</Text>
              </View>
              {c.currency === currency ? <Check size={18} color="#94F27F" /> : null}
            </Pressable>
          ))}
          {currencies.length === 0 ? (
            <Text className="py-8 text-center text-sm text-muted-foreground">
              No currencies found
            </Text>
          ) : null}
        </ScrollView>
      )}
    </View>
  );
};

export default TransfiCurrencySelector;
