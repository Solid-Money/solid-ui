import React from 'react';
import { Controller } from 'react-hook-form';
import { Linking, Pressable, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';

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
                  className={`w-6 h-6 rounded ${
                    value ? 'bg-[#94F27F]' : 'bg-[#333331] '
                  } items-center justify-center`}
                >
                  {value && <Text className="text-xs text-black font-bold">✓</Text>}
                </View>
              </Pressable>
            )}
          />

          <View className="flex-1">
            <Text className="text-base text-[#ACACAC] leading-4">
              By clicking continue you are agreeing to the{' '}
              <Text
                className="text-base text-white underline font-bold"
                onPress={() => Linking.openURL('https://bridge.xyz/legal')}
              >
                Electronic Signature Consent
              </Text>
            </Text>
          </View>
        </View>
      )}

      {errors.agreedToEsign && kycMode === KycMode.CARD && (
        <Text className="text-red-500 text-sm text-center">{errors.agreedToEsign.message}</Text>
      )}

      <View className="flex-row items-start justify-center">
        <Controller
          control={control}
          name="agreedToTerms"
          render={({ field: { onChange, value } }) => (
            <Pressable onPress={() => onChange(!value)} className="mr-3 mt-0.5">
              <View
                className={`w-6 h-6 rounded ${
                  value ? 'bg-[#94F27F]' : 'bg-[#333331] '
                } items-center justify-center`}
              >
                {value && <Text className="text-xs text-black font-bold">✓</Text>}
              </View>
            </Pressable>
          )}
        />

        <View className="flex-1">
          {kycMode === KycMode.CARD ? (
            <Text className="text-base text-[#ACACAC] leading-4">
              This application uses Bridge to securely connect account and move funds. By clicking
              continue, you agree to Bridge&apos;s{' '}
              <Text
                className="text-base text-white underline font-bold"
                onPress={() => Linking.openURL('https://bridge.xyz/legal')}
              >
                Terms of Service
              </Text>{' '}
              and{' '}
              <Text
                className="text-base text-white underline font-bold"
                onPress={() => Linking.openURL('https://bridge.xyz/legal')}
              >
                Privacy Policy
              </Text>{' '}
              and{' '}
              <Text
                className="text-base text-white underline font-bold"
                onPress={() => Linking.openURL('https://solid.xyz')}
              >
                Lead Bank Cardholder Agreement
              </Text>{' '}
              and{' '}
              <Text
                className="text-base text-white underline font-bold"
                onPress={() => Linking.openURL('https://solid.xyz')}
              >
                Lead Bank Privacy Policy
              </Text>
            </Text>
          ) : (
            <Text className="text-base text-[#ACACAC] leading-4">
              This application uses Bridge to securely connect accounts and move funds. By clicking
              continue, you agree to Bridge&apos;s{' '}
              <Text
                className="text-base text-white underline"
                onPress={() => Linking.openURL('https://bridge.xyz/legal')}
              >
                Terms of Service
              </Text>{' '}
              and{' '}
              <Text
                className="text-base text-white underline"
                onPress={() => Linking.openURL('https://bridge.xyz/legal')}
              >
                Privacy Policy
              </Text>
              .
            </Text>
          )}
        </View>
      </View>

      {errors.agreedToTerms && (
        <Text className="text-red-500 text-sm text-center">{errors.agreedToTerms.message}</Text>
      )}

      <Button
        className="h-14 rounded-xl mt-8 bg-[#94F27F]"
        onPress={onContinue}
        disabled={!isValid || isLoading}
      >
        <Text className="text-lg font-bold text-black">
          {isLoading ? 'Please wait...' : 'Continue'}
        </Text>
      </Button>
    </View>
  );
}
