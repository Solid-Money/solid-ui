import { zodResolver } from '@hookform/resolvers/zod';
import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { View } from 'react-native';
import { z } from 'zod';

import { UserInfoFooter, UserInfoForm, UserInfoHeader } from '@/components/UserKyc';
import { KycMode, type UserInfoFormData, userInfoSchema } from '@/components/UserKyc/types';
import { createKycLink } from '@/lib/api';
import { startKycFlow } from '@/lib/utils/kyc';
import { useLocalSearchParams, useRouter } from 'expo-router';

// Main Component
export default function UserKycInfo() {
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  // redirectUri tells where to resume after KYC.
  const params = useLocalSearchParams<{
    redirectUri?: string;
    endorsement?: string;
    kycMode?: KycMode;
  }>();

  const { redirectUri, kycMode } = params;

  const schema = userInfoSchema.superRefine((data, ctx) => {
    if ((kycMode as KycMode) === KycMode.CARD && data.agreedToEsign !== true) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'You must agree to the Electronic Signature Consent to continue',
        path: ['agreedToEsign'],
      });
    }
  });

  const {
    control,
    handleSubmit,
    formState: { errors, isValid },
  } = useForm<UserInfoFormData>({
    resolver: zodResolver(schema),
    mode: 'onChange',
    defaultValues: {
      fullName: '',
      email: '',
      agreedToTerms: false,
      agreedToEsign: false,
    },
  });

  const getRedirectUrl = () => {
    const baseUrl = process.env.EXPO_PUBLIC_BASE_URL;
    return (redirectUri as string) || `${baseUrl}`;
  };

  const onSubmit = async (data: UserInfoFormData) => {
    setIsLoading(true);

    const redirectUrl = getRedirectUrl();
    console.warn('redirectUrl', redirectUrl);

    try {
      const kycLink = await getKycLink(redirectUrl, data);

      if (!kycLink) {
        throw new Error('An error occurred while creating the KYC link');
      }

      startKycFlow({ router, kycLink });
    } catch (error) {
      console.error('KYC link creation failed:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View className="flex-1 bg-[#262624] px-6 pt-4">
      <View className="w-full web:max-w-3xl web:mx-auto">
        <View className="flex-1 justify-evenly">
          <UserInfoHeader kycMode={kycMode as any} />

          <UserInfoForm control={control} errors={errors} />

          <UserInfoFooter
            control={control}
            errors={errors}
            onContinue={handleSubmit(onSubmit)}
            isValid={isValid}
            isLoading={isLoading}
            kycMode={kycMode as KycMode}
          />
        </View>
      </View>
    </View>
  );

  async function getKycLink(
    redirectUrl: string,
    data: { fullName: string; email: string; agreedToTerms: boolean },
  ) {
    const endorsements = params.endorsement ? [params.endorsement] : [];

    const newKycLink = await createKycLink(
      data.fullName.trim(),
      data.email.trim(),
      redirectUrl,
      endorsements,
    );

    return newKycLink.link;
  }
}
