import React from 'react';
import { Controller } from 'react-hook-form';
import { Linking, Pressable, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { Underline } from '@/components/ui/underline';

import { KycMode } from './types';

interface UserInfoFooterProps {
  control: any;
  errors: any;
  onContinue: () => void;
  isValid: boolean;
  isLoading: boolean;
  kycMode?: KycMode;
}

export function UserInfoFooter({
  control,
  errors,
  onContinue,
  isValid,
  isLoading,
  kycMode,
}: UserInfoFooterProps) {
  return (
    <View className="space-y-6">
      {kycMode === KycMode.CARD && (
        <View className="flex-row items-start justify-center">
          <Controller
            control={control}
            name="agreedToEsign"
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
            <Text className="text-base leading-4 text-[#ACACAC]">
              By clicking continue you are agreeing to the{' '}
              <Underline
                inline
                textClassName="text-base font-bold text-white"
                borderColor="rgba(255, 255, 255, 1)"
                onPress={() => Linking.openURL('https://bridge.xyz/legal')}
              >
                Electronic Signature Consent
              </Underline>
            </Text>
          </View>
        </View>
      )}

      {errors.agreedToEsign && kycMode === KycMode.CARD && (
        <Text className="text-center text-sm text-red-500">{errors.agreedToEsign.message}</Text>
      )}

      <View className="flex-row items-start justify-center">
        <Controller
          control={control}
          name="agreedToTerms"
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
          {kycMode === KycMode.CARD ? (
            <Text className="text-base leading-4 text-[#ACACAC]">
              This application uses Bridge to securely connect account and move funds. By clicking
              continue, you agree to Bridge&apos;s{' '}
              <Underline
                inline
                textClassName="text-base font-bold text-white"
                borderColor="rgba(255, 255, 255, 1)"
                onPress={() => Linking.openURL('https://bridge.xyz/legal')}
              >
                Terms of Service
              </Underline>{' '}
              and{' '}
              <Underline
                inline
                textClassName="text-base font-bold text-white"
                borderColor="rgba(255, 255, 255, 1)"
                onPress={() => Linking.openURL('https://bridge.xyz/legal')}
              >
                Privacy Policy
              </Underline>{' '}
              and{' '}
              <Underline
                inline
                textClassName="text-base font-bold text-white"
                borderColor="rgba(255, 255, 255, 1)"
                onPress={() => Linking.openURL('https://solid.xyz')}
              >
                Lead Bank Cardholder Agreement
              </Underline>{' '}
              and{' '}
              <Underline
                inline
                textClassName="text-base font-bold text-white"
                borderColor="rgba(255, 255, 255, 1)"
                onPress={() => Linking.openURL('https://solid.xyz')}
              >
                Lead Bank Privacy Policy
              </Underline>
            </Text>
          ) : (
            <Text className="text-base leading-4 text-[#ACACAC]">
              This application uses Bridge to securely connect accounts and move funds. By clicking
              continue, you agree to Bridge&apos;s{' '}
              <Underline
                inline
                textClassName="text-base text-white"
                borderColor="rgba(255, 255, 255, 1)"
                onPress={() => Linking.openURL('https://bridge.xyz/legal')}
              >
                Terms of Service
              </Underline>{' '}
              and{' '}
              <Underline
                inline
                textClassName="text-base text-white"
                borderColor="rgba(255, 255, 255, 1)"
                onPress={() => Linking.openURL('https://bridge.xyz/legal')}
              >
                Privacy Policy
              </Underline>
              .
            </Text>
          )}
        </View>
      </View>

      {errors.agreedToTerms && (
        <Text className="text-center text-sm text-red-500">{errors.agreedToTerms.message}</Text>
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
