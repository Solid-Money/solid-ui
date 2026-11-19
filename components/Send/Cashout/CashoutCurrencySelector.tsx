import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { ChevronRight, Search } from 'lucide-react-native';

import { Text } from '@/components/ui/text';
import { SEND_MODAL } from '@/constants/modals';
import { TRACKING_EVENTS } from '@/constants/tracking-events';
import { useDimension } from '@/hooks/useDimension';
import { useTransfiCashoutConfig } from '@/hooks/useTransfiCashout';
import { track } from '@/lib/analytics';
import {
  arrangeCashoutCurrencies,
  CASHOUT_METHOD_TYPE_LABEL,
  cashoutCurrencyTitle,
  CashoutFilter,
  cashoutMethodTags,
  onlyCashoutMethod,
  VISIBLE_METHOD_TAGS,
} from '@/lib/cashoutMethods';
import { asTransfiError } from '@/lib/transfiErrors';
import { cn } from '@/lib/utils';
import { useCashoutStore } from '@/store/useCashoutStore';
import { useSendStore } from '@/store/useSendStore';

import type { TransfiCashoutCurrency } from '@/lib/types';

const FILTERS: { value: CashoutFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'bank', label: CASHOUT_METHOD_TYPE_LABEL.bank },
  { value: 'mobile_money', label: CASHOUT_METHOD_TYPE_LABEL.mobile_money },
];

/**
 * A filter label's colour, kept out of its classes. On the web a Text's classes
 * pile up across renders instead of being replaced, so after picking another
 * filter and coming back, "All" carried both `text-black` and `text-white` and
 * came out white on its white pill. A plain object stays an inline style, which
 * wins on the web as the `style` prop does on native (see AiApiSetupGuide).
 */
const FILTER_LABEL = { color: '#ffffff' };
const ACTIVE_FILTER_LABEL = { color: '#000000' };

const Tag = ({ label }: { label: string }) => (
  <View className="rounded-md bg-white/10 px-2 py-1">
    <Text className="text-[13px] font-medium leading-4 text-white/80" numberOfLines={1}>
      {label}
    </Text>
  </View>
);

const CurrencyRow = ({
  option,
  filter,
  isSelected,
  isLast,
  onPress,
}: {
  option: TransfiCashoutCurrency;
  filter: CashoutFilter;
  isSelected: boolean;
  isLast: boolean;
  onPress: () => void;
}) => {
  const title = cashoutCurrencyTitle(option);
  const tags = cashoutMethodTags(option.methods, filter === 'bank' ? 'bank' : 'mobile_money');
  const visible = tags.slice(0, VISIBLE_METHOD_TAGS);
  const hidden = tags.length - visible.length;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={[`Get paid in ${title}`, option.country ? option.currency : '', ...tags]
        .filter(Boolean)
        .join(', ')}
      accessibilityState={{ selected: isSelected }}
      className={cn(
        'min-h-16 flex-row items-center gap-3 px-4 py-3.5 active:bg-white/10 web:hover:bg-white/[0.06]',
        !isLast && 'border-b border-white/10',
        isSelected && 'bg-white/[0.06]',
      )}
      onPress={onPress}
    >
      {option.logoUrl ? (
        <Image
          source={{ uri: option.logoUrl }}
          style={{ width: 40, height: 40, borderRadius: 20 }}
          contentFit="cover"
        />
      ) : (
        <View className="h-10 w-10 rounded-full bg-white/10" />
      )}
      <View className="min-w-0 flex-1 gap-1.5">
        <View className="flex-row items-center gap-2">
          <Text className="shrink text-base font-semibold text-white" numberOfLines={1}>
            {title}
          </Text>
          {option.country ? (
            <View className="rounded-md bg-white/10 px-1.5 py-0.5">
              <Text className="text-xs font-medium text-white/60">{option.currency}</Text>
            </View>
          ) : null}
        </View>
        {visible.length ? (
          <View className="flex-row flex-wrap gap-1.5">
            {visible.map(tag => (
              <Tag key={tag} label={tag} />
            ))}
            {hidden > 0 ? <Tag label={`+${hidden}`} /> : null}
          </View>
        ) : null}
      </View>
      <ChevronRight size={18} color="rgba(255,255,255,0.4)" />
    </Pressable>
  );
};

const CurrencyList = ({
  options,
  filter,
  currency,
  onSelect,
}: {
  options: TransfiCashoutCurrency[];
  filter: CashoutFilter;
  currency?: string;
  onSelect: (option: TransfiCashoutCurrency) => void;
}) => (
  <View className="overflow-hidden rounded-2xl bg-card">
    {options.map((option, index) => (
      <CurrencyRow
        key={option.currency}
        option={option}
        filter={filter}
        isSelected={option.currency === currency}
        isLast={index === options.length - 1}
        onPress={() => onSelect(option)}
      />
    ))}
  </View>
);

const SectionLabel = ({ children }: { children: string }) => (
  <Text className="px-1 text-sm font-medium text-white/50">{children}</Text>
);

const countriesWith = (count: number, filter: Exclude<CashoutFilter, 'all'>) =>
  `${count} ${count === 1 ? 'country' : 'countries'} with ${CASHOUT_METHOD_TYPE_LABEL[
    filter
  ].toLowerCase()}`;

/**
 * First cash-out step: where to be paid. Each country shows how it pays out —
 * PalmPay, M-Pesa, PIX, bank transfer — so the choice is made knowing what
 * comes next. A country with a single way to be paid goes straight to its
 * account details.
 */
export const CashoutCurrencySelector = () => {
  const setModal = useSendStore(state => state.setModal);
  const currency = useCashoutStore(state => state.currency);
  const { data: config, isLoading, error } = useTransfiCashoutConfig();
  const { isScreenMedium } = useDimension();
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<CashoutFilter>('all');

  const currencies = useMemo(() => config?.currencies ?? [], [config?.currencies]);
  const { yours, others } = useMemo(
    () =>
      arrangeCashoutCurrencies({
        currencies,
        defaultCurrency: config?.defaultCurrency,
        filter,
        query,
      }),
    [currencies, config?.defaultCurrency, filter, query],
  );
  // Without methods (an older server, or TransFi down for every currency)
  // the chips could only empty the list.
  const canFilter = currencies.some(option => option.methods?.length);
  const isNarrowed = filter !== 'all' || Boolean(query.trim());
  const shown = yours ? [yours, ...others] : others;

  const handleSelect = (option: TransfiCashoutCurrency) => {
    const only = onlyCashoutMethod(option);
    track(TRACKING_EVENTS.CASH_OUT_CURRENCY_SELECTED, {
      currency: option.currency,
      method_count: option.methods?.length,
      filter,
      searched: Boolean(query.trim()),
    });
    const store = useCashoutStore.getState();
    // Picking the same currency again keeps what was already typed for it.
    if (option.currency !== store.currency) store.setCurrency(option.currency);
    if (!only) {
      setModal(SEND_MODAL.OPEN_CASHOUT_METHOD);
      return;
    }
    // One way to be paid: nothing to choose, so straight to its details.
    track(TRACKING_EVENTS.CASH_OUT_METHOD_SELECTED, {
      currency: option.currency,
      payment_code: only.paymentCode,
      method_type: only.type,
      only_method: true,
    });
    if (only.paymentCode !== useCashoutStore.getState().paymentCode) {
      useCashoutStore.getState().setPaymentCode(only.paymentCode);
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

  const emptyMessage = query.trim()
    ? 'No country, currency or method matches'
    : filter !== 'all'
      ? `No countries with ${CASHOUT_METHOD_TYPE_LABEL[filter].toLowerCase()}`
      : 'No payout currencies available';

  return (
    <KeyboardAvoidingView
      className={cn(!isScreenMedium && 'min-h-0 flex-1')}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      enabled={!isScreenMedium && Platform.OS !== 'web'}
    >
      <View className={cn('gap-4', !isScreenMedium && 'min-h-0 flex-1')}>
        <View className="h-[54px] flex-row items-center gap-3 rounded-2xl bg-card px-4">
          <Search size={20} color="rgba(255,255,255,0.5)" />
          <TextInput
            accessibilityLabel="Search countries, currencies and payout methods"
            value={query}
            onChangeText={setQuery}
            placeholder="Search country, currency or method"
            placeholderTextColor="rgba(255,255,255,0.4)"
            autoCapitalize="none"
            autoCorrect={false}
            className="flex-1 p-0 text-base font-medium text-white web:outline-none"
          />
        </View>
        {canFilter ? (
          <View className="flex-row gap-2" accessibilityRole="tablist">
            {FILTERS.map(option => {
              const isActive = option.value === filter;
              return (
                <Pressable
                  key={option.value}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: isActive }}
                  className={cn(
                    'h-9 justify-center rounded-full px-4',
                    isActive ? 'bg-white' : 'bg-card active:bg-white/10 web:hover:bg-white/10',
                  )}
                  onPress={() => setFilter(option.value)}
                >
                  <Text
                    className="text-sm font-medium"
                    style={isActive ? ACTIVE_FILTER_LABEL : FILTER_LABEL}
                  >
                    {option.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        ) : null}
        <ScrollView
          className={isScreenMedium ? 'max-h-[50vh]' : 'min-h-0 flex-1'}
          contentContainerStyle={
            !isScreenMedium ? { paddingBottom: 16 + insets.bottom } : undefined
          }
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {!shown.length ? (
            <View className="items-center rounded-2xl bg-card px-6 py-10">
              <Text className="text-center text-sm font-medium text-white/50">{emptyMessage}</Text>
            </View>
          ) : isNarrowed ? (
            <View className="gap-2">
              {filter !== 'all' ? (
                <SectionLabel>{countriesWith(shown.length, filter)}</SectionLabel>
              ) : null}
              <CurrencyList
                options={shown}
                filter={filter}
                currency={currency}
                onSelect={handleSelect}
              />
            </View>
          ) : (
            <View className="gap-5">
              {yours ? (
                <View className="gap-2">
                  <SectionLabel>Your currency</SectionLabel>
                  <CurrencyList
                    options={[yours]}
                    filter={filter}
                    currency={currency}
                    onSelect={handleSelect}
                  />
                </View>
              ) : null}
              {others.length ? (
                <View className="gap-2">
                  <SectionLabel>All countries</SectionLabel>
                  <CurrencyList
                    options={others}
                    filter={filter}
                    currency={currency}
                    onSelect={handleSelect}
                  />
                </View>
              ) : null}
            </View>
          )}
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
};

export default CashoutCurrencySelector;
