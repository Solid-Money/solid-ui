import { zodResolver } from '@hookform/resolvers/zod';
import * as WebBrowser from 'expo-web-browser';
import React, { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Linking, Platform, Pressable, TextInput, View } from 'react-native';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { path } from '@/constants/path';
import { createKycLink } from '@/lib/api';
import { KycStatus } from '@/lib/types';
import { useRouter } from 'expo-router';

// Zod schema for validation
const userInfoSchema = z.object({
  fullName: z
    .string()
    .min(1, 'Please enter your full name')
    .min(2, 'Full name must be at least 2 characters'),
  email: z
    .string()
    .min(1, 'Please enter your email address')
    .email('Please enter a valid email address'),
  agreedToTerms: z.boolean().refine(val => val === true, 'You must agree to the terms to continue'),
});

type UserInfoFormData = z.infer<typeof userInfoSchema>;

// Header Component
function UserInfoHeader() {
  return (
    <Text className="text-base text-white/70 text-center">
      We need some basic information to get started with your card activation
    </Text>
  );
}

// Form Component
interface UserInfoFormProps {
  control: any;
  errors: any;
}

function UserInfoForm({ control, errors }: UserInfoFormProps) {
  return (
    <View className="space-y-6 mb-8">
      <View>
        <Text className="text-sm font-medium text-white/80 mb-2">Full Name</Text>
        <Controller
          control={control}
          name="fullName"
          render={({ field: { onChange, value } }) => (
            <TextInput
              placeholder="Enter your full name"
              value={value}
              onChangeText={onChange}
              className="h-14 px-6 rounded-xl border border-border text-lg text-foreground font-semibold placeholder:text-muted-foreground bg-background"
              autoCapitalize="words"
            />
          )}
        />
        {errors.fullName && (
          <Text className="text-red-500 text-sm mt-1">{errors.fullName.message}</Text>
        )}
      </View>

      <View>
        <Text className="text-sm font-medium text-white/80 mb-2 mt-6">Email Address</Text>
        <Controller
          control={control}
          name="email"
          render={({ field: { onChange, value } }) => (
            <TextInput
              placeholder="Enter your email address"
              value={value}
              onChangeText={onChange}
              keyboardType="email-address"
              className="h-14 px-6 rounded-xl border border-border text-lg text-foreground font-semibold placeholder:text-muted-foreground bg-background"
              autoCapitalize="none"
              autoComplete="email"
            />
          )}
        />
        {errors.email && <Text className="text-red-500 text-sm mt-1">{errors.email.message}</Text>}
      </View>
    </View>
  );
}

// Footer Component
interface UserInfoFooterProps {
  control: any;
  errors: any;
  onContinue: () => void;
  isValid: boolean;
  isLoading: boolean;
}

function UserInfoFooter({ control, errors, onContinue, isValid, isLoading }: UserInfoFooterProps) {
  return (
    <View className="space-y-6">
      <View className="flex-row items-start justify-center">
        <Controller
          control={control}
          name="agreedToTerms"
          render={({ field: { onChange, value } }) => (
            <Pressable onPress={() => onChange(!value)} className="mr-3 mt-0.5">
              <View
                className={`w-6 h-6 rounded border-2 ${
                  value ? 'bg-[#94F27F] border-[#94F27F]' : 'border-white/50'
                } items-center justify-center`}
              >
                {value && <Text className="text-xs text-black font-bold">✓</Text>}
              </View>
            </Pressable>
          )}
        />

        <View className="flex-1">
          <View className="text-xs text-white/50 leading-4 flex-row flex-wrap">
            <Text className="text-xs text-white/50">
              This application uses Bridge to securely connect accounts and move funds. By clicking
              continue, you agree to Bridge{"'"}s{' '}
            </Text>
            <Pressable onPress={() => Linking.openURL('https://bridge.xyz/legal')}>
              <Text className="text-xs text-[#94F27F] underline">Terms of Service</Text>
            </Pressable>
            <Text className="text-xs text-white/50"> and </Text>
            <Pressable onPress={() => Linking.openURL('https://bridge.xyz/legal')}>
              <Text className="text-xs text-[#94F27F] underline">Privacy Policy</Text>
            </Pressable>
            <Text className="text-xs text-white/50">.</Text>
          </View>
        </View>
      </View>

      {errors.agreedToTerms && (
        <Text className="text-red-500 text-sm text-center">{errors.agreedToTerms.message}</Text>
      )}

      <Button
        className="h-14 rounded-xl mt-8"
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

// Main Component
export default function UserInfoMobile() {
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const {
    control,
    handleSubmit,
    formState: { errors, isValid },
  } = useForm<UserInfoFormData>({
    resolver: zodResolver(userInfoSchema),
    mode: 'onChange',
    defaultValues: {
      fullName: '',
      email: '',
      agreedToTerms: false,
    },
  });

  const getRedirectUrl = () => {
    const baseUrl = process.env.EXPO_PUBLIC_BASE_URL;
    return `${baseUrl}${path.CARD_ACTIVATE_MOBILE}?kycStatus=${KycStatus.UNDER_REVIEW}`;
  };

  const onSubmit = async (data: UserInfoFormData) => {
    setIsLoading(true);

    const redirectUrl = getRedirectUrl();
    console.log('redirectUrl', redirectUrl);

    try {
      const kycLink = await createKycLink(data.fullName.trim(), data.email.trim(), redirectUrl);

      if (Platform.OS === 'ios' || Platform.OS === 'android') {
        WebBrowser.openBrowserAsync(kycLink.link, {
          presentationStyle: WebBrowser.WebBrowserPresentationStyle.FULL_SCREEN,
          controlsColor: '#94F27F',
          toolbarColor: '#94F27F',
          showTitle: true,
          enableBarCollapsing: true,
        });
      } else {
        router.push({
          pathname: path.CARD_KYC,
          params: {
            url: kycLink.link,
          },
        });
      }
    } catch (error) {
      console.error('KYC link creation failed:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View className="flex-1 bg-background px-6 pt-4">
      <View className="flex-1 justify-evenly">
        <UserInfoHeader />

        <UserInfoForm control={control} errors={errors} />

        <UserInfoFooter
          control={control}
          errors={errors}
          onContinue={handleSubmit(onSubmit)}
          isValid={isValid}
          isLoading={isLoading}
        />
      </View>
    </View>
  );
}
