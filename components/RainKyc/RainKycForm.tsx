import React from 'react';
import { Control, Controller, useWatch } from 'react-hook-form';
import { Linking, Platform, Pressable, ScrollView, TextInput, View } from 'react-native';

import { Text } from '@/components/ui/text';
import { Underline } from '@/components/ui/underline';
import { EXPO_PUBLIC_BASE_URL } from '@/lib/config';

import { RAIN_OCCUPATION_OPTIONS } from './occupationCodes';

import type { RainKycDocumentFiles, RainKycFormData } from './rainKycSchema';

const RAIN_PARTNER_NAME = 'Solid';
const underlineProps = {
  textClassName: 'text-base font-bold text-white' as const,
  borderColor: 'rgba(255, 255, 255, 1)' as const,
};

const inputClassName = 'h-12 rounded-xl bg-[#333331] px-4 text-base font-medium text-white';
const labelClassName = 'mb-1.5 text-sm font-medium text-[#ACACAC]';
const errorClassName = 'mt-1 text-sm text-red-500';

type FieldErrors = Record<keyof RainKycFormData, { message?: string } | undefined>;

export type RainKycFormProps = {
  control: Control<RainKycFormData>;
  errors: FieldErrors;
  documentFiles: RainKycDocumentFiles;
  onIdDocumentTypeChange: (type: RainKycDocumentFiles['idDocumentType']) => void;
  onFileSelect: (
    key: 'idDocument' | 'idDocumentFront' | 'idDocumentBack' | 'selfie',
    file: File | null,
  ) => void;
};

export function RainKycForm({
  control,
  errors,
  documentFiles,
  onIdDocumentTypeChange,
  onFileSelect,
}: RainKycFormProps) {
  const isPassport = documentFiles.idDocumentType === 'passport';
  const country = useWatch({ control, name: 'country' });
  const isUS = country?.toUpperCase() === 'US';
  const baseUrl = EXPO_PUBLIC_BASE_URL || 'https://solid.xyz';

  function CheckboxRow({
    name,
    children,
  }: {
    name: keyof RainKycFormData;
    children: React.ReactNode;
  }) {
    return (
      <View className="mt-3">
        <View className="flex-row items-start">
          <Controller
            control={control}
            name={name}
            render={({ field: { onChange, value } }) => (
              <Pressable onPress={() => onChange(!value)} className="mr-3 mt-0.5">
                <View
                  className={`h-5 w-5 items-center justify-center rounded ${
                    value ? 'bg-[#94F27F]' : 'bg-[#333331]'
                  }`}
                >
                  {value && <Text className="text-xs font-bold text-black">✓</Text>}
                </View>
              </Pressable>
            )}
          />
          <View className="flex-1">
            <Text className="text-sm leading-5 text-[#ACACAC]">{children}</Text>
          </View>
        </View>
        {errors[name] && <Text className={errorClassName}>{errors[name].message}</Text>}
      </View>
    );
  }

  return (
    <ScrollView className="flex-1">
      <View className="gap-4">
        <View className="flex-row gap-3">
          <View className="flex-1">
            <Text className={labelClassName}>First name</Text>
            <Controller
              control={control}
              name="firstName"
              render={({ field: { onChange, value } }) => (
                <TextInput
                  value={value}
                  onChangeText={onChange}
                  className={inputClassName}
                  autoCapitalize="words"
                  placeholderTextColor="#888"
                />
              )}
            />
            {errors.firstName && <Text className={errorClassName}>{errors.firstName.message}</Text>}
          </View>
          <View className="flex-1">
            <Text className={labelClassName}>Last name</Text>
            <Controller
              control={control}
              name="lastName"
              render={({ field: { onChange, value } }) => (
                <TextInput
                  value={value}
                  onChangeText={onChange}
                  className={inputClassName}
                  autoCapitalize="words"
                  placeholderTextColor="#888"
                />
              )}
            />
            {errors.lastName && <Text className={errorClassName}>{errors.lastName.message}</Text>}
          </View>
        </View>

        <View>
          <Text className={labelClassName}>Date of birth (YYYY-MM-DD)</Text>
          <Controller
            control={control}
            name="birthDate"
            render={({ field: { onChange, value } }) => (
              <TextInput
                value={value}
                onChangeText={onChange}
                className={inputClassName}
                placeholder="2000-01-01"
                placeholderTextColor="#888"
              />
            )}
          />
          {errors.birthDate && <Text className={errorClassName}>{errors.birthDate.message}</Text>}
        </View>

        <View>
          <Text className={labelClassName}>National ID (e.g. SSN in US)</Text>
          <Controller
            control={control}
            name="nationalId"
            render={({ field: { onChange, value } }) => (
              <TextInput
                value={value}
                onChangeText={onChange}
                className={inputClassName}
                placeholderTextColor="#888"
                keyboardType={Platform.OS === 'web' ? 'default' : 'number-pad'}
              />
            )}
          />
          {errors.nationalId && <Text className={errorClassName}>{errors.nationalId.message}</Text>}
        </View>

        <View>
          <Text className={labelClassName}>Country of issue (2-letter)</Text>
          <Controller
            control={control}
            name="countryOfIssue"
            render={({ field: { onChange, value } }) => (
              <TextInput
                value={value}
                onChangeText={onChange}
                className={inputClassName}
                placeholder="US"
                placeholderTextColor="#888"
                autoCapitalize="characters"
                maxLength={2}
              />
            )}
          />
          {errors.countryOfIssue && (
            <Text className={errorClassName}>{errors.countryOfIssue.message}</Text>
          )}
        </View>

        <View>
          <Text className={labelClassName}>Email</Text>
          <Controller
            control={control}
            name="email"
            render={({ field: { onChange, value } }) => (
              <TextInput
                value={value}
                onChangeText={onChange}
                className={inputClassName}
                keyboardType="email-address"
                autoCapitalize="none"
                placeholderTextColor="#888"
              />
            )}
          />
          {errors.email && <Text className={errorClassName}>{errors.email.message}</Text>}
        </View>

        <View className="flex-row gap-3">
          <View className="w-24">
            <Text className={labelClassName}>Country code</Text>
            <Controller
              control={control}
              name="phoneCountryCode"
              render={({ field: { onChange, value } }) => (
                <TextInput
                  value={value}
                  onChangeText={onChange}
                  className={inputClassName}
                  keyboardType="phone-pad"
                  placeholder="1"
                  placeholderTextColor="#888"
                />
              )}
            />
            {errors.phoneCountryCode && (
              <Text className={errorClassName}>{errors.phoneCountryCode.message}</Text>
            )}
          </View>
          <View className="flex-1">
            <Text className={labelClassName}>Phone number</Text>
            <Controller
              control={control}
              name="phoneNumber"
              render={({ field: { onChange, value } }) => (
                <TextInput
                  value={value}
                  onChangeText={onChange}
                  className={inputClassName}
                  keyboardType="phone-pad"
                  placeholderTextColor="#888"
                />
              )}
            />
            {errors.phoneNumber && (
              <Text className={errorClassName}>{errors.phoneNumber.message}</Text>
            )}
          </View>
        </View>

        <View>
          <Text className={labelClassName}>Street address</Text>
          <Controller
            control={control}
            name="street"
            render={({ field: { onChange, value } }) => (
              <TextInput
                value={value}
                onChangeText={onChange}
                className={inputClassName}
                placeholderTextColor="#888"
              />
            )}
          />
          {errors.street && <Text className={errorClassName}>{errors.street.message}</Text>}
        </View>

        <View className="flex-row gap-3">
          <View className="flex-1">
            <Text className={labelClassName}>City</Text>
            <Controller
              control={control}
              name="city"
              render={({ field: { onChange, value } }) => (
                <TextInput
                  value={value}
                  onChangeText={onChange}
                  className={inputClassName}
                  placeholderTextColor="#888"
                />
              )}
            />
            {errors.city && <Text className={errorClassName}>{errors.city.message}</Text>}
          </View>
          <View className="flex-1">
            <Text className={labelClassName}>State / Region</Text>
            <Controller
              control={control}
              name="region"
              render={({ field: { onChange, value } }) => (
                <TextInput
                  value={value}
                  onChangeText={onChange}
                  className={inputClassName}
                  placeholderTextColor="#888"
                />
              )}
            />
            {errors.region && <Text className={errorClassName}>{errors.region.message}</Text>}
          </View>
        </View>

        <View className="flex-row gap-3">
          <View className="flex-1">
            <Text className={labelClassName}>Postal code</Text>
            <Controller
              control={control}
              name="postalCode"
              render={({ field: { onChange, value } }) => (
                <TextInput
                  value={value}
                  onChangeText={onChange}
                  className={inputClassName}
                  placeholderTextColor="#888"
                />
              )}
            />
            {errors.postalCode && (
              <Text className={errorClassName}>{errors.postalCode.message}</Text>
            )}
          </View>
          <View className="flex-1">
            <Text className={labelClassName}>Country (2-letter)</Text>
            <Controller
              control={control}
              name="country"
              render={({ field: { onChange, value } }) => (
                <TextInput
                  value={value}
                  onChangeText={onChange}
                  className={inputClassName}
                  placeholder="US"
                  placeholderTextColor="#888"
                  autoCapitalize="characters"
                  maxLength={2}
                />
              )}
            />
            {errors.country && <Text className={errorClassName}>{errors.country.message}</Text>}
          </View>
        </View>

        <View>
          <Text className={labelClassName}>Occupation</Text>
          <Controller
            control={control}
            name="occupation"
            render={({ field: { onChange, value } }) =>
              Platform.OS === 'web' && typeof document !== 'undefined' ? (
                <select
                  value={value}
                  onChange={e => onChange(e.target.value)}
                  className={inputClassName}
                  style={{
                    backgroundColor: '#333331',
                    color: '#fff',
                    paddingLeft: 16,
                    paddingRight: 16,
                    paddingTop: 12,
                    paddingBottom: 12,
                    borderRadius: 12,
                    fontSize: 16,
                    minHeight: 48,
                  }}
                >
                  <option value="">Select occupation</option>
                  {RAIN_OCCUPATION_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              ) : (
                <TextInput
                  value={value}
                  onChangeText={onChange}
                  className={inputClassName}
                  placeholder="e.g. 13-2051 or SELFEMP"
                  placeholderTextColor="#888"
                />
              )
            }
          />
          {errors.occupation && <Text className={errorClassName}>{errors.occupation.message}</Text>}
        </View>

        <View>
          <Text className={labelClassName}>Annual salary</Text>
          <Controller
            control={control}
            name="annualSalary"
            render={({ field: { onChange, value } }) => (
              <TextInput
                value={value}
                onChangeText={onChange}
                className={inputClassName}
                placeholder="e.g. 80000"
                placeholderTextColor="#888"
                keyboardType="decimal-pad"
              />
            )}
          />
          {errors.annualSalary && (
            <Text className={errorClassName}>{errors.annualSalary.message}</Text>
          )}
        </View>

        <View>
          <Text className={labelClassName}>Account purpose</Text>
          <Controller
            control={control}
            name="accountPurpose"
            render={({ field: { onChange, value } }) => (
              <TextInput
                value={value}
                onChangeText={onChange}
                className={inputClassName}
                placeholder="e.g. Personal spending"
                placeholderTextColor="#888"
              />
            )}
          />
          {errors.accountPurpose && (
            <Text className={errorClassName}>{errors.accountPurpose.message}</Text>
          )}
        </View>

        <View>
          <Text className={labelClassName}>Expected monthly volume (USD)</Text>
          <Controller
            control={control}
            name="expectedMonthlyVolume"
            render={({ field: { onChange, value } }) => (
              <TextInput
                value={value}
                onChangeText={onChange}
                className={inputClassName}
                placeholder="e.g. 2000"
                placeholderTextColor="#888"
                keyboardType="decimal-pad"
              />
            )}
          />
          {errors.expectedMonthlyVolume && (
            <Text className={errorClassName}>{errors.expectedMonthlyVolume.message}</Text>
          )}
        </View>

        {/* ID document type */}
        <View>
          <Text className={labelClassName}>ID document type</Text>
          <Controller
            control={control}
            name="idDocumentType"
            render={({ field: { onChange, value } }) => (
              <View className="flex-row flex-wrap gap-2">
                {(['passport', 'idCard', 'drivers', 'residencePermit'] as const).map(type => (
                  <Pressable
                    key={type}
                    onPress={() => {
                      onChange(type);
                      onIdDocumentTypeChange(type);
                    }}
                    className={`rounded-xl px-4 py-2 ${
                      value === type ? 'bg-[#94F27F]' : 'bg-[#333331]'
                    }`}
                  >
                    <Text
                      className={value === type ? 'font-semibold' : 'text-white'}
                      style={value === type ? { color: '#000' } : undefined}
                    >
                      {type === 'idCard'
                        ? 'ID Card'
                        : type === 'residencePermit'
                          ? 'Residence permit'
                          : type.charAt(0).toUpperCase() + type.slice(1)}
                    </Text>
                  </Pressable>
                ))}
              </View>
            )}
          />
        </View>

        {/* ID document upload(s) */}
        <View>
          <Text className={labelClassName}>
            {isPassport ? 'Passport (one file)' : 'ID document (front and back)'}
          </Text>
          {isPassport ? (
            <FileUploadButton
              label={documentFiles.idDocument ? documentFiles.idDocument.name : 'Upload passport'}
              onFileSelect={file => onFileSelect('idDocument', file)}
              accept="image/*,.pdf"
            />
          ) : (
            <View className="gap-2">
              <FileUploadButton
                label={
                  documentFiles.idDocumentFront
                    ? documentFiles.idDocumentFront.name
                    : 'Upload front'
                }
                onFileSelect={file => onFileSelect('idDocumentFront', file)}
                accept="image/*,.pdf"
              />
              <FileUploadButton
                label={
                  documentFiles.idDocumentBack ? documentFiles.idDocumentBack.name : 'Upload back'
                }
                onFileSelect={file => onFileSelect('idDocumentBack', file)}
                accept="image/*,.pdf"
              />
            </View>
          )}
        </View>

        <View>
          <Text className={labelClassName}>Selfie</Text>
          <FileUploadButton
            label={documentFiles.selfie ? documentFiles.selfie.name : 'Upload selfie'}
            onFileSelect={file => onFileSelect('selfie', file)}
            accept="image/*"
          />
        </View>

        <View className="mt-6 space-y-1">
          <Text className="mb-2 text-sm font-medium text-[#ACACAC]">Agreements</Text>
          <CheckboxRow name="agreedToEsign">
            I accept the{' '}
            <Underline
              inline
              {...underlineProps}
              onPress={() => Linking.openURL(`${baseUrl}/legal/esign-consent`)}
            >
              E-Sign Consent
            </Underline>
          </CheckboxRow>

          {isUS && (
            <CheckboxRow name="agreedToAccountOpeningPrivacy">
              I accept the{' '}
              <Underline
                inline
                {...underlineProps}
                onPress={() => Linking.openURL(`${baseUrl}/legal/account-opening-privacy`)}
              >
                Account Opening Privacy Notice
              </Underline>
            </CheckboxRow>
          )}

          <View className="mt-3">
            <Controller
              control={control}
              name="isTermsOfServiceAccepted"
              render={({ field: { onChange, value } }) => (
                <View className="flex-row items-start">
                  <Pressable onPress={() => onChange(!value)} className="mr-3 mt-0.5">
                    <View
                      className={`h-5 w-5 items-center justify-center rounded ${
                        value ? 'bg-[#94F27F]' : 'bg-[#333331]'
                      }`}
                    >
                      {value && <Text className="text-xs font-bold text-black">✓</Text>}
                    </View>
                  </Pressable>
                  <Pressable onPress={() => onChange(!value)} className="flex-1">
                    <Text className="text-sm text-[#ACACAC]">
                      I accept the{' '}
                      <Underline
                        inline
                        {...underlineProps}
                        onPress={() => Linking.openURL(`${baseUrl}/legal/card-terms`)}
                      >
                        {RAIN_PARTNER_NAME} Card Terms
                      </Underline>
                      , and the{' '}
                      <Underline
                        inline
                        {...underlineProps}
                        onPress={() => Linking.openURL(`${baseUrl}/legal/issuer-privacy`)}
                      >
                        Issuer Privacy Policy
                      </Underline>
                    </Text>
                  </Pressable>
                </View>
              )}
            />
            {errors.isTermsOfServiceAccepted && (
              <Text className={errorClassName}>{errors.isTermsOfServiceAccepted.message}</Text>
            )}
          </View>

          <CheckboxRow name="agreedToCertify">
            I certify that the information I have provided is accurate and that I will abide by all
            the rules and requirements related to my {RAIN_PARTNER_NAME} Spend Card.
          </CheckboxRow>

          <CheckboxRow name="agreedToNoSolicitation">
            I acknowledge that applying for the {RAIN_PARTNER_NAME} Spend Card does not constitute
            unauthorized solicitation.
          </CheckboxRow>
        </View>
      </View>
    </ScrollView>
  );
}

function FileUploadButton({
  label,
  onFileSelect,
  accept,
}: {
  label: string;
  onFileSelect: (file: File | null) => void;
  accept: string;
}) {
  const inputRef = React.useRef<HTMLInputElement | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    onFileSelect(file);
    e.target.value = '';
  };

  if (Platform.OS !== 'web') {
    return (
      <View className="rounded-xl border border-dashed border-[#555] p-4">
        <Text className="text-[#ACACAC]">
          File upload on native: use web or add document picker
        </Text>
      </View>
    );
  }

  return (
    <>
      <input
        ref={inputRef as any}
        type="file"
        accept={accept}
        onChange={handleChange}
        style={{ display: 'none' }}
      />
      <Pressable
        onPress={() => inputRef.current?.click()}
        className="rounded-xl border border-dashed border-[#555] bg-[#333331] px-4 py-3"
      >
        <Text className="text-white">{label}</Text>
      </Pressable>
    </>
  );
}
