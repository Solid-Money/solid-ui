import React from 'react';
import { Controller } from 'react-hook-form';
import { Linking, Pressable, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { Underline } from '@/components/ui/underline';
import { EXPO_PUBLIC_BASE_URL } from '@/lib/config';

import { KycMode, RainConsumerType } from './types';

const RAIN_PARTNER_NAME = 'Solid';
const underlineProps = {
  textClassName: 'text-base font-bold text-white' as const,
  borderColor: 'rgba(255, 255, 255, 1)' as const,
};

function CheckboxRow({
  control,
  name,
  children,
  error,
}: {
  control: any;
  name: string;
  children: React.ReactNode;
  error?: string;
}) {
  return (
    <View>
      <View className="flex-row items-start justify-center">
        <Controller
          control={control}
          name={name}
          render={({ field: { onChange, value } }) => (
            <Pressable onPress={() => onChange(!value)} className="mr-3 mt-0.5">
              <View
                className={`h-6 w-6 rounded ${
                  value ? 'bg-[#94F27F]' : 'bg-[#333331] '
                } items-center justify-center`}
              >
                {value && <Text className="text-xs font-bold text-black">✓</Text>}
              </View>
            </Pressable>
          )}
        />
        <View className="flex-1">
          <Text className="text-base leading-4 text-[#ACACAC]">{children}</Text>
        </View>
      </View>
      {error && <Text className="mt-1 text-center text-sm text-red-500">{error}</Text>}
    </View>
  );
}

interface UserInfoFooterProps {
  control: any;
  errors: any;
  onContinue: () => void;
  isValid: boolean;
  isLoading: boolean;
  kycMode?: KycMode;
  consumerType?: RainConsumerType;
}

export function UserInfoFooter({
  control,
  errors,
  onContinue,
  isValid,
  isLoading,
  kycMode,
  consumerType,
}: UserInfoFooterProps) {
  const isCard = kycMode === KycMode.CARD;
  const isUS = consumerType === RainConsumerType.US;
  const baseUrl = EXPO_PUBLIC_BASE_URL || 'https://solid.xyz';

  return (
    <View className="space-y-6">
      {isCard && (
        <CheckboxRow
          control={control}
          name="agreedToEsign"
          error={errors.agreedToEsign?.message}
        >
          I accept the{' '}
          <Underline
            inline
            {...underlineProps}
            onPress={() => Linking.openURL(`${baseUrl}/legal/esign-consent`)}
          >
            E-Sign Consent
          </Underline>
        </CheckboxRow>
      )}

      {isCard && isUS && (
        <CheckboxRow
          control={control}
          name="agreedToAccountOpeningPrivacy"
          error={errors.agreedToAccountOpeningPrivacy?.message}
        >
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

      <CheckboxRow control={control} name="agreedToTerms" error={errors.agreedToTerms?.message}>
        {isCard ? (
          <>
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
          </>
        ) : (
          <>
            This application uses Bridge to securely connect accounts and move funds. By clicking
            continue, you agree to Bridge&apos;s{' '}
            <Underline
              inline
              {...underlineProps}
              onPress={() => Linking.openURL('https://bridge.xyz/legal')}
            >
              Terms of Service
            </Underline>{' '}
            and{' '}
            <Underline
              inline
              {...underlineProps}
              onPress={() => Linking.openURL('https://bridge.xyz/legal')}
            >
              Privacy Policy
            </Underline>
            .
          </>
        )}
      </CheckboxRow>

      {isCard && (
        <CheckboxRow
          control={control}
          name="agreedToCertify"
          error={errors.agreedToCertify?.message}
        >
          I certify that the information I have provided is accurate and that I will abide by all
          the rules and requirements related to my {RAIN_PARTNER_NAME} Spend Card.
        </CheckboxRow>
      )}

      {isCard && (
        <CheckboxRow
          control={control}
          name="agreedToNoSolicitation"
          error={errors.agreedToNoSolicitation?.message}
        >
          I acknowledge that applying for the {RAIN_PARTNER_NAME} Spend Card does not constitute
          unauthorized solicitation.
        </CheckboxRow>
      )}

      <Button
        className="mt-8 h-14 rounded-xl bg-[#94F27F]"
        onPress={onContinue}
        disabled={!isValid || isLoading}
      >
        <Text className="text-base font-bold text-black">
          {isLoading ? 'Please wait...' : 'Continue'}
        </Text>
      </Button>
    </View>
  );
}
