import { useMemo, useState } from 'react';
import { ActivityIndicator, KeyboardTypeOptions, Pressable, ScrollView, View } from 'react-native';
import { Check, ChevronDown, Lock } from 'lucide-react-native';

import { Button } from '@/components/ui/button';
import Input from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { SEND_MODAL } from '@/constants/modals';
import { TRACKING_EVENTS } from '@/constants/tracking-events';
import { useTransfiCashoutPaymentMethods } from '@/hooks/useTransfiCashout';
import { track } from '@/lib/analytics';
import { validatePayoutDetails, validatePayoutField } from '@/lib/payoutFields';
import { cn } from '@/lib/utils';
import { useCashoutStore } from '@/store/useCashoutStore';
import { useSendStore } from '@/store/useSendStore';

import type { TransfiPayoutField } from '@/lib/types';

const KEYBOARD: Partial<Record<TransfiPayoutField['type'], KeyboardTypeOptions>> = {
  email: 'email-address',
  phone: 'phone-pad',
  number: 'number-pad',
};

/** A list long enough that scrolling it needs a search box (banks, mostly). */
const SEARCHABLE_OPTIONS = 8;

/**
 * Third cash-out step: the account details the chosen method needs.
 *
 * The fields are whatever TransFi lists for the method — IBAN and BIC for
 * SEPA, a phone number for M-Pesa, a PIX key for Brazil — so a corridor's
 * requirements change without a release. Each is checked against TransFi's own
 * rules as it is typed; the server checks again, and anything it still refuses
 * comes back here against the field it was about.
 */
export const CashoutDetailsForm = () => {
  const setModal = useSendStore(state => state.setModal);
  const currency = useCashoutStore(state => state.currency);
  const paymentCode = useCashoutStore(state => state.paymentCode);
  const details = useCashoutStore(state => state.paymentDetails);
  const setPaymentDetails = useCashoutStore(state => state.setPaymentDetails);
  const serverFieldErrors = useCashoutStore(state => state.fieldErrors);
  const setFieldErrors = useCashoutStore(state => state.setFieldErrors);
  const { data: methods, isLoading } = useTransfiCashoutPaymentMethods(currency);
  const method = methods?.find(m => m.paymentCode === paymentCode);

  // Only shown once a field has been left, or after a Continue attempt — an
  // empty form full of red is not a welcome.
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [submitted, setSubmitted] = useState(false);

  const fields = useMemo(() => method?.fields ?? [], [method]);
  const editable = fields.filter(field => !field.locked);
  const locked = fields.filter(field => field.locked);

  const errorFor = (field: TransfiPayoutField) => {
    const server = serverFieldErrors[field.key];
    if (server) return server;
    if (!submitted && !touched[field.key]) return undefined;
    return validatePayoutField(field, details[field.key]);
  };

  const setValue = (key: string, value: string) => {
    setPaymentDetails({ ...details, [key]: value });
    // A server complaint about a field is answered by editing that field.
    if (serverFieldErrors[key]) {
      const rest = { ...serverFieldErrors };
      delete rest[key];
      setFieldErrors(rest);
    }
  };

  const handleContinue = () => {
    setSubmitted(true);
    const { errors } = validatePayoutDetails(fields, details);
    if (Object.keys(errors).length || Object.keys(serverFieldErrors).length) return;
    track(TRACKING_EVENTS.CASH_OUT_DETAILS_SUBMITTED, {
      currency,
      payment_code: paymentCode,
      field_count: fields.length,
    });
    setModal(SEND_MODAL.OPEN_CASHOUT_AMOUNT);
  };

  if (isLoading || !method) {
    return (
      <View className="items-center justify-center py-10">
        <ActivityIndicator size="large" color="#94F27F" />
      </View>
    );
  }

  return (
    <View className="gap-6">
      <ScrollView className="max-h-[55vh]" showsVerticalScrollIndicator={false}>
        <View className="gap-5">
          {locked.length ? (
            <View className="gap-2">
              <Text className="text-base font-medium opacity-70">Account holder</Text>
              <View className="gap-3 rounded-2xl bg-card p-4">
                {locked.map(field => (
                  <View key={field.key} className="flex-row items-center justify-between">
                    <Text className="text-sm text-muted-foreground">{field.label}</Text>
                    <View className="flex-row items-center gap-2">
                      <Text className="text-base font-semibold">{field.value}</Text>
                      <Lock size={14} color="rgba(255,255,255,0.5)" />
                    </View>
                  </View>
                ))}
                <Text className="text-xs text-white/50">
                  From your verified ID. Payouts can only go to an account in your name.
                </Text>
              </View>
            </View>
          ) : null}

          {editable.map(field => (
            <View key={field.key} className="gap-2">
              <Text className="text-base font-medium opacity-70">
                {field.label}
                {field.required ? '' : ' (optional)'}
              </Text>
              {field.type === 'select' ? (
                <SelectField
                  field={field}
                  value={details[field.key]}
                  onChange={value => {
                    setValue(field.key, value);
                    setTouched(prev => ({ ...prev, [field.key]: true }));
                  }}
                  error={Boolean(errorFor(field))}
                />
              ) : (
                <Input
                  accessibilityLabel={field.label}
                  value={details[field.key] ?? ''}
                  onChangeText={text => setValue(field.key, text)}
                  onBlur={() => setTouched(prev => ({ ...prev, [field.key]: true }))}
                  keyboardType={KEYBOARD[field.type] ?? 'default'}
                  autoCapitalize={field.type === 'text' ? 'characters' : 'none'}
                  autoCorrect={false}
                  maxLength={field.maxLength}
                  error={Boolean(errorFor(field))}
                />
              )}
              {field.description ? (
                <Text className="text-xs text-white/50">{field.description}</Text>
              ) : null}
              {errorFor(field) ? (
                <Text className="text-sm text-red-400">{errorFor(field)}</Text>
              ) : null}
            </View>
          ))}
        </View>
      </ScrollView>

      <Button variant="brand" className="h-12 rounded-xl" size="lg" onPress={handleContinue}>
        <Text className="text-base font-bold text-black">Continue</Text>
      </Button>
    </View>
  );
};

const SelectField = ({
  field,
  value,
  onChange,
  error,
}: {
  field: TransfiPayoutField;
  value?: string;
  onChange: (value: string) => void;
  error: boolean;
}) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const options = field.options ?? [];
  const selected = options.find(option => option.value === value);
  const visible = query.trim()
    ? options.filter(option => option.label.toLowerCase().includes(query.trim().toLowerCase()))
    : options;

  return (
    <View className="gap-2">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${field.label}: ${selected?.label ?? 'not chosen'}`}
        onPress={() => setOpen(prev => !prev)}
        className={cn(
          'h-14 flex-row items-center justify-between rounded-xl border border-transparent bg-[#1F1F1F] px-6',
          error && 'border-red-500',
        )}
      >
        <Text
          className={cn('text-lg font-semibold', !selected && 'text-muted-foreground')}
          numberOfLines={1}
        >
          {selected?.label ?? `Choose ${field.label.toLowerCase()}`}
        </Text>
        <ChevronDown size={18} color="white" />
      </Pressable>
      {open ? (
        <View className="overflow-hidden rounded-xl bg-card">
          {options.length > SEARCHABLE_OPTIONS ? (
            <Input
              accessibilityLabel={`Search ${field.label}`}
              value={query}
              onChangeText={setQuery}
              placeholder="Search"
              autoCorrect={false}
              className="rounded-none"
            />
          ) : null}
          <ScrollView className="max-h-60" nestedScrollEnabled>
            {visible.map(option => (
              <Pressable
                key={option.value}
                accessibilityRole="button"
                onPress={() => {
                  onChange(option.value);
                  setOpen(false);
                  setQuery('');
                }}
                className="flex-row items-center justify-between border-b border-white/10 px-4 py-3 active:bg-white/10"
              >
                <Text className="text-base">{option.label}</Text>
                {option.value === value ? <Check size={16} color="#94F27F" /> : null}
              </Pressable>
            ))}
          </ScrollView>
        </View>
      ) : null}
    </View>
  );
};

export default CashoutDetailsForm;
