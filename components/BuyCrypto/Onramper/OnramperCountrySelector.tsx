import { useMemo, useState } from 'react';
import { Pressable, ScrollView, TextInput, View } from 'react-native';
import { Check, Search, X } from 'lucide-react-native';

import { useBuyCryptoNavigation } from '@/components/BuyCrypto/Transfi/BuyCryptoNavigation';
import CountryFlagImage from '@/components/CountryFlagImage';
import { Text } from '@/components/ui/text';
import { COUNTRIES } from '@/constants/countries';
import { DEPOSIT_MODAL } from '@/constants/modals';
import { TRACKING_EVENTS } from '@/constants/tracking-events';
import useOnramperAvailability from '@/hooks/useOnramperAvailability';
import { track } from '@/lib/analytics';
import {
  ONRAMPER_APPLE_PAY_COUNTRIES,
  ONRAMPER_QUOTING_COUNTRIES,
} from '@/lib/onramperAvailability';
import { cn } from '@/lib/utils';
import { useOnramperStore } from '@/store/useOnramperStore';

/**
 * Picks the country the flow quotes against. qa/preview builds only.
 *
 * Onramper serves very few countries, and which ones is not guessable from the
 * outside — so the list is annotated rather than flat. Without that a tester
 * picking at random sees an empty asset list and cannot tell whether they hit a
 * bug or a country Onramper simply does not serve.
 *
 * The labels are a snapshot, not a gate: nothing here filters the list, and the
 * real answer always comes from the quote. They exist to make an empty result
 * legible, and are cheap to correct when Onramper's coverage changes.
 */
export const OnramperCountrySelector = () => {
  const setModal = useBuyCryptoNavigation();
  const { countryCode } = useOnramperAvailability();
  const setCountry = useOnramperStore(state => state.setCountry);
  const [query, setQuery] = useState('');

  const countries = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matched = q
      ? COUNTRIES.filter(c => c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q))
      : COUNTRIES;

    // Countries that actually price first, then the ones that at least offer
    // Apple Pay — a flat alphabetical list buries the only working option
    // somewhere past Trinidad.
    const rank = (code: string) =>
      ONRAMPER_QUOTING_COUNTRIES.includes(code)
        ? 0
        : ONRAMPER_APPLE_PAY_COUNTRIES.includes(code)
          ? 1
          : 2;

    return [...matched].sort((a, b) => rank(a.code) - rank(b.code) || a.name.localeCompare(b.name));
  }, [query]);

  const handleSelect = (code: string) => {
    track(TRACKING_EVENTS.ONRAMPER_COUNTRY_SELECTED, {
      country: code,
      previous_country: countryCode,
      quotes: ONRAMPER_QUOTING_COUNTRIES.includes(code),
    });
    setCountry(code);
    setModal(DEPOSIT_MODAL.OPEN_ONRAMPER_AMOUNT);
  };

  return (
    <View className="flex-1 gap-4">
      <Text className="text-xs font-medium leading-[17px] text-white/50">
        Testing only. Onramper prices in very few countries — the working ones are listed first.
      </Text>

      <View className="h-[54px] flex-row items-center gap-3 rounded-[15px] bg-[#1C1C1C] px-4">
        <Search size={20} color="rgba(255,255,255,0.5)" />
        <TextInput
          accessibilityLabel="Search countries"
          value={query}
          onChangeText={setQuery}
          placeholder="Search country"
          placeholderTextColor="rgba(255,255,255,0.4)"
          autoCorrect={false}
          className="flex-1 p-0 text-base font-medium text-white web:outline-none"
        />
        {query ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Clear country search"
            className="h-7 w-7 items-center justify-center rounded-full bg-white/10 active:opacity-70"
            onPress={() => setQuery('')}
          >
            <X size={15} color="rgba(255,255,255,0.7)" />
          </Pressable>
        ) : null}
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 8 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View className="overflow-hidden rounded-[15px] bg-[#1C1C1C]">
          {countries.map((country, index) => {
            const isSelected = country.code === countryCode;
            const quotes = ONRAMPER_QUOTING_COUNTRIES.includes(country.code);
            const applePay = ONRAMPER_APPLE_PAY_COUNTRIES.includes(country.code);

            return (
              <Pressable
                key={country.code}
                accessibilityRole="button"
                accessibilityLabel={`Select ${country.name}`}
                accessibilityState={{ selected: isSelected }}
                className={cn(
                  'h-16 flex-row items-center justify-between gap-3 px-4 active:bg-white/10 web:hover:bg-white/[0.06]',
                  index < countries.length - 1 && 'border-b border-white/10',
                  isSelected && 'bg-white/[0.06]',
                )}
                onPress={() => handleSelect(country.code)}
              >
                <View className="min-w-0 flex-1 flex-row items-center gap-3">
                  <CountryFlagImage isoCode={country.code} size={24} />
                  <Text className="shrink text-base font-medium text-white" numberOfLines={1}>
                    {country.name}
                  </Text>
                  {quotes ? (
                    <View className="rounded-[18px] bg-brand/20 px-2 py-[3px]">
                      <Text className="text-xs font-semibold leading-4 text-brand">Quotes</Text>
                    </View>
                  ) : applePay ? (
                    <View className="rounded-[18px] bg-white/10 px-2 py-[3px]">
                      <Text className="text-xs leading-4 text-white/60">No quotes</Text>
                    </View>
                  ) : null}
                </View>
                {isSelected ? (
                  <View className="h-6 w-6 items-center justify-center rounded-full bg-brand">
                    <Check size={15} color="#111111" strokeWidth={2.5} />
                  </View>
                ) : null}
              </Pressable>
            );
          })}
          {countries.length === 0 ? (
            <View className="items-center px-6 py-10">
              <Text className="text-center text-sm font-medium text-white/50">
                No countries found
              </Text>
            </View>
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
};

export default OnramperCountrySelector;
