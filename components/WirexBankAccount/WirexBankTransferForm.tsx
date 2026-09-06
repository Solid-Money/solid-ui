import { useMemo } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';

import Input from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { WirexBankAccountType } from '@/lib/types/wirex-bank';

import {
  REFERENCE_MAX_LENGTH,
  WirexTransferFormErrors,
  WirexTransferFormState,
} from './transferFormState';

/** A labelled field with its validation message underneath. */
const Field = ({
  label,
  value,
  onChangeText,
  error,
  placeholder,
  keyboardType,
  autoCapitalize = 'none',
  maxLength,
}: {
  label: string;
  value: string;
  onChangeText: (next: string) => void;
  error?: string;
  placeholder?: string;
  keyboardType?: 'default' | 'decimal-pad' | 'number-pad';
  autoCapitalize?: 'none' | 'characters' | 'words';
  maxLength?: number;
}) => (
  <View className="gap-2">
    <Text className="text-[14px] leading-5 text-white/70">{label}</Text>
    <Input
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      keyboardType={keyboardType}
      autoCapitalize={autoCapitalize}
      autoCorrect={false}
      maxLength={maxLength}
      error={!!error}
    />
    {error ? <Text className="text-[13px] leading-4 text-red-400">{error}</Text> : null}
  </View>
);

export interface WirexBankTransferFormProps {
  accountType: WirexBankAccountType;
  currency: string;
  form: WirexTransferFormState;
  onChange: (next: WirexTransferFormState) => void;
  /** Only shown after a submit attempt, so the form is not red on first paint. */
  errors: WirexTransferFormErrors;
}

/**
 * Recipient and amount for an outbound SEPA or ACH transfer.
 *
 * SEPA needs an IBAN and BIC; ACH needs an account number, a routing number and
 * the recipient's postal address — Wirex requires the address on that rail and
 * rejects the transfer without it.
 */
export const WirexBankTransferForm = ({
  accountType,
  currency,
  form,
  onChange,
  errors,
}: WirexBankTransferFormProps) => {
  const set = useMemo(
    () =>
      <K extends keyof WirexTransferFormState>(key: K) =>
      (value: WirexTransferFormState[K]) =>
        onChange({ ...form, [key]: value }),
    [form, onChange],
  );

  const isSepa = accountType === WirexBankAccountType.SEPA;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      className="flex-1"
    >
      <ScrollView
        className="flex-1"
        contentContainerClassName="gap-5 pb-8"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Field
          label={`Amount (${currency})`}
          value={form.amount}
          onChangeText={set('amount')}
          error={errors.amount}
          placeholder="0.00"
          keyboardType="decimal-pad"
        />

        <View className="flex-row gap-3">
          <View className="flex-1">
            <Field
              label="First name"
              value={form.firstName}
              onChangeText={set('firstName')}
              error={errors.firstName}
              autoCapitalize="words"
            />
          </View>
          <View className="flex-1">
            <Field
              label="Last name"
              value={form.lastName}
              onChangeText={set('lastName')}
              error={errors.lastName}
              autoCapitalize="words"
            />
          </View>
        </View>

        {isSepa ? (
          <>
            <Field
              label="IBAN"
              value={form.iban}
              onChangeText={set('iban')}
              error={errors.iban}
              placeholder="DE89 3704 0044 0532 0130 00"
              autoCapitalize="characters"
              maxLength={42}
            />
            <Field
              label="BIC / SWIFT"
              value={form.bic}
              onChangeText={set('bic')}
              error={errors.bic}
              placeholder="COBADEFFXXX"
              autoCapitalize="characters"
              maxLength={11}
            />
          </>
        ) : (
          <>
            <Field
              label="Account number"
              value={form.accountNumber}
              onChangeText={set('accountNumber')}
              error={errors.accountNumber}
              keyboardType="number-pad"
              maxLength={18}
            />
            <Field
              label="Routing number"
              value={form.routingNumber}
              onChangeText={set('routingNumber')}
              error={errors.routingNumber}
              keyboardType="number-pad"
              maxLength={9}
            />
            <Field
              label="Street address"
              value={form.addressLine1}
              onChangeText={set('addressLine1')}
              error={errors.addressLine1}
              autoCapitalize="words"
            />
            <View className="flex-row gap-3">
              <View className="flex-1">
                <Field
                  label="City"
                  value={form.city}
                  onChangeText={set('city')}
                  error={errors.city}
                  autoCapitalize="words"
                />
              </View>
              <View className="w-[110px]">
                <Field
                  label="State"
                  value={form.state}
                  onChangeText={set('state')}
                  error={errors.state}
                  autoCapitalize="characters"
                  maxLength={3}
                />
              </View>
            </View>
            <View className="flex-row gap-3">
              <View className="flex-1">
                <Field
                  label="Postal code"
                  value={form.zipCode}
                  onChangeText={set('zipCode')}
                  error={errors.zipCode}
                  autoCapitalize="characters"
                />
              </View>
              <View className="w-[110px]">
                <Field
                  label="Country"
                  value={form.country}
                  onChangeText={set('country')}
                  error={errors.country}
                  placeholder="US"
                  autoCapitalize="characters"
                  maxLength={2}
                />
              </View>
            </View>
          </>
        )}

        <Field
          label="Reference (optional)"
          value={form.reference}
          onChangeText={set('reference')}
          error={errors.reference}
          placeholder="Invoice 12345"
          autoCapitalize="words"
          maxLength={REFERENCE_MAX_LENGTH}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
};
