import PageLayout from '@/components/PageLayout';
import { Text } from '@/components/ui/text';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft } from 'lucide-react-native';
import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Pressable, View } from 'react-native';
import { z } from 'zod';

import { UserInfoFooter, UserInfoForm, UserInfoHeader } from '@/components/UserKyc';
import { KycMode, type UserInfoFormData, userInfoSchema } from '@/components/UserKyc/types';
import { createKycLink } from '@/lib/api';
import { startKycFlow } from '@/lib/utils/kyc';
import { useKycStore } from '@/store/useKycStore';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Toast from 'react-native-toast-message';

// Main Component
export default function UserKycInfo() {
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const { setKycLinkId } = useKycStore();

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

      // Save KYC link ID to local storage
      setKycLinkId(kycLink.kycLinkId);

      startKycFlow({ router, kycLink: kycLink.link });
    } catch (error) {
      console.error('KYC link creation failed:', error);

      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'An error occurred while creating the KYC link',
        props: {
          badgeText: '',
        },
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <PageLayout desktopOnly>
      <View className="flex-1 w-full max-w-lg mx-auto pt-8 px-6">
        <View className="flex-row items-center justify-between">
          <Pressable onPress={() => router.back()} className="web:hover:opacity-70">
            <ArrowLeft color="white" />
          </Pressable>
          <Text className="text-white text-xl md:text-2xl font-semibold text-center">
            Identity verification
          </Text>
          <View className="w-10" />
        </View>

        <View className="flex-1 mt-8 justify-evenly">
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
    </PageLayout>
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

    return {
      kycLinkId: newKycLink.kycLinkId,
      link: newKycLink.link,
    };
  }
}
