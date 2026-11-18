import { ActivityIndicator, Pressable, View } from 'react-native';
import { Image } from 'expo-image';
import { ChevronRight, Info, Landmark, Smartphone } from 'lucide-react-native';

import { Text } from '@/components/ui/text';
import { SEND_MODAL } from '@/constants/modals';
import { TRACKING_EVENTS } from '@/constants/tracking-events';
import {
  useTransfiCashoutConfig,
  useTransfiCashoutPaymentMethods,
} from '@/hooks/useTransfiCashout';
import { track } from '@/lib/analytics';
import { CASHOUT_METHOD_TYPE_LABEL, isMobileMoneyMethod } from '@/lib/cashoutMethods';
import { asTransfiError } from '@/lib/transfiErrors';
import { cn } from '@/lib/utils';
import { useCashoutStore } from '@/store/useCashoutStore';
import { useSendStore } from '@/store/useSendStore';

import type { TransfiCashoutMethodType, TransfiCashoutPaymentMethod } from '@/lib/types';

const formatLimit = (value: number | undefined, currency: string) =>
  value == null ? undefined : `${value.toLocaleString()} ${currency}`;

/** A bank picked inside the method's own form, rather than one method per bank. */
const hasBankChoice = (method: TransfiCashoutPaymentMethod) =>
  method.fields.some(
    field =>
      field.type === 'select' &&
      (field.options?.length ?? 0) > 1 &&
      /bank/i.test(`${field.key} ${field.label}`),
  );

/** Where the money lands and how much it can be, as far as the method says. */
const describeMethod = (
  method: TransfiCashoutPaymentMethod,
  currency: string,
  country: string | undefined,
) => {
  const max = formatLimit(method.maxAmount, currency);
  const where = isMobileMoneyMethod(method)
    ? method.fields.some(field => field.type === 'phone')
      ? 'To your phone number'
      : undefined
    : hasBankChoice(method)
      ? country
        ? `Any bank in ${country}`
        : 'Any bank'
      : undefined;
  return [where, max && `up to ${max}`].filter(Boolean).join(' · ');
};

const SECTION_ORDER: TransfiCashoutMethodType[] = ['mobile_money', 'bank'];

/**
 * Second cash-out step, shown only when there's a choice: how to be paid —
 * a mobile wallet, a bank. Grouped by kind, so a long list of banks doesn't
 * bury the wallet.
 */
export const CashoutMethodSelector = () => {
  const setModal = useSendStore(state => state.setModal);
  const currency = useCashoutStore(state => state.currency);
  const paymentCode = useCashoutStore(state => state.paymentCode);
  const setPaymentCode = useCashoutStore(state => state.setPaymentCode);
  const { data: config } = useTransfiCashoutConfig();
  const { data: methods, isLoading, error } = useTransfiCashoutPaymentMethods(currency);
  const option = config?.currencies.find(c => c.currency === currency);
  const country = option?.country;

  const handleSelect = (method: TransfiCashoutPaymentMethod) => {
    track(TRACKING_EVENTS.CASH_OUT_METHOD_SELECTED, {
      currency,
      payment_code: method.paymentCode,
      payment_type: method.paymentType,
      method_type: isMobileMoneyMethod(method) ? 'mobile_money' : 'bank',
    });
    // The details form starts from what the verified profile already says.
    if (method.paymentCode !== paymentCode) setPaymentCode(method.paymentCode);
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
        <Text className="text-center text-base font-semibold">
          No way to pay out in {country ?? currency}
        </Text>
        <Text className="text-center text-sm text-muted-foreground">
          {error
            ? asTransfiError(error).message
            : 'Our payment partner has no payout methods for this currency yet.'}
        </Text>
      </View>
    );
  }

  const sections = SECTION_ORDER.map(type => ({
    type,
    methods: methods.filter(method =>
      type === 'mobile_money' ? isMobileMoneyMethod(method) : !isMobileMoneyMethod(method),
    ),
  })).filter(section => section.methods.length);

  return (
    <View className="gap-5">
      <View className="gap-3">
        <View className="flex-row items-center gap-2 self-start rounded-full bg-card py-1.5 pl-1.5 pr-3">
          {option?.logoUrl ? (
            <Image
              source={{ uri: option.logoUrl }}
              style={{ width: 22, height: 22, borderRadius: 11 }}
              contentFit="cover"
            />
          ) : null}
          <Text className="text-sm font-medium text-white">
            {country ? `${country} · ${currency}` : currency}
          </Text>
        </View>
        <Text className="text-2xl font-semibold text-white">How do you want to get paid?</Text>
      </View>

      {sections.map(section => (
        <View key={section.type} className="gap-2">
          <Text className="px-1 text-sm font-medium text-white/50">
            {CASHOUT_METHOD_TYPE_LABEL[section.type]}
          </Text>
          <View className="overflow-hidden rounded-2xl bg-card">
            {section.methods.map((method, index) => {
              const subtitle = describeMethod(method, currency ?? '', country);
              return (
                <Pressable
                  key={method.paymentCode}
                  accessibilityRole="button"
                  accessibilityLabel={`Send to ${method.paymentName ?? method.paymentCode}`}
                  className={cn(
                    'min-h-16 flex-row items-center gap-3 px-4 py-3.5 active:bg-white/10 web:hover:bg-white/[0.06]',
                    index < section.methods.length - 1 && 'border-b border-white/10',
                    method.paymentCode === paymentCode && 'bg-white/[0.06]',
                  )}
                  onPress={() => handleSelect(method)}
                >
                  {method.logo ? (
                    <Image
                      source={{ uri: method.logo }}
                      style={{ width: 40, height: 40, borderRadius: 20 }}
                      contentFit="contain"
                    />
                  ) : (
                    <View className="h-10 w-10 items-center justify-center rounded-full bg-white/10">
                      {section.type === 'mobile_money' ? (
                        <Smartphone size={18} color="white" />
                      ) : (
                        <Landmark size={18} color="white" />
                      )}
                    </View>
                  )}
                  <View className="flex-1">
                    <Text className="text-base font-semibold text-white" numberOfLines={1}>
                      {method.paymentName ?? method.paymentCode}
                    </Text>
                    {subtitle ? <Text className="text-sm text-white/50">{subtitle}</Text> : null}
                  </View>
                  <ChevronRight size={18} color="rgba(255,255,255,0.4)" />
                </Pressable>
              );
            })}
          </View>
        </View>
      ))}

      <View className="flex-row items-center gap-2.5 rounded-2xl bg-card px-4 py-3.5">
        <Info size={16} color="rgba(255,255,255,0.6)" />
        <Text className="flex-1 text-sm text-white/60">
          Payouts can only go to an account in your name.
        </Text>
      </View>
    </View>
  );
};

export default CashoutMethodSelector;
