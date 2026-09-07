import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, TextInput, View } from 'react-native';
import { Image } from 'expo-image';
import { Check, Search, X } from 'lucide-react-native';

import { useBuyCryptoNavigation } from '@/components/BuyCrypto/Transfi/BuyCryptoNavigation';
import { Text } from '@/components/ui/text';
import { DEPOSIT_MODAL } from '@/constants/modals';
import { TRACKING_EVENTS } from '@/constants/tracking-events';
import { useOnramperConfig } from '@/hooks/useOnramper';
import useOnramperAvailability from '@/hooks/useOnramperAvailability';
import { track } from '@/lib/analytics';
import { cn } from '@/lib/utils';
import { useOnramperStore } from '@/store/useOnramperStore';

const ICON_STYLE = { width: 32, height: 32, borderRadius: 16 };

/** Full-step fiat currency picker (opened from the amount screen). */
export const OnramperCurrencySelector = () => {
  const setModal = useBuyCryptoNavigation();
  const { countryCode } = useOnramperAvailability();

  const fiatCurrency = useOnramperStore(state => state.fiatCurrency);
  const setFiatCurrency = useOnramperStore(state => state.setFiatCurrency);

  const { data: config, isLoading } = useOnramperConfig(countryCode);
  const [query, setQuery] = useState('');

  const currencies = useMemo(() => {
    const list = config?.currencies ?? [];
    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list.filter(c => c.code.toLowerCase().includes(q) || c.name.toLowerCase().includes(q));
  }, [config?.currencies, query]);

  const handleSelect = (id: string, code: string) => {
    track(TRACKING_EVENTS.ONRAMPER_CURRENCY_SELECTED, {
      currency: code,
      previous_currency: fiatCurrency ?? undefined,
      searched: query.trim().length > 0,
    });
    // Also clears the asset — the deliverable list is per-currency.
    setFiatCurrency(id);
    setModal(DEPOSIT_MODAL.OPEN_ONRAMPER_AMOUNT);
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
            {currencies.map((currency, index) => {
              const isSelected = currency.id === fiatCurrency;

              return (
                <Pressable
                  key={currency.id}
                  accessibilityRole="button"
                  accessibilityLabel={`Select ${currency.code}`}
                  accessibilityState={{ selected: isSelected }}
                  className={cn(
                    'h-16 flex-row items-center justify-between px-4 active:bg-white/10 web:hover:bg-white/[0.06]',
                    index < currencies.length - 1 && 'border-b border-white/10',
                    isSelected && 'bg-white/[0.06]',
                  )}
                  onPress={() => handleSelect(currency.id, currency.code)}
                >
                  <View className="min-w-0 flex-1 flex-row items-center gap-3">
                    {currency.icon ? (
                      <Image
                        source={{ uri: currency.icon }}
                        style={ICON_STYLE}
                        contentFit="contain"
                      />
                    ) : (
                      <View className="h-8 w-8 rounded-full bg-white/10" />
                    )}
                    <Text className="text-base font-semibold text-white">{currency.code}</Text>
                    <Text className="min-w-0 flex-1 text-sm text-white/50" numberOfLines={1}>
                      {currency.name}
                    </Text>
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

export default OnramperCurrencySelector;
