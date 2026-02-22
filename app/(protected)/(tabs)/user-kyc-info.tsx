import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Pressable, View } from 'react-native';
import Toast from 'react-native-toast-message';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft } from 'lucide-react-native';
import { z } from 'zod';

import PageLayout from '@/components/PageLayout';
import { Text } from '@/components/ui/text';
import { UserInfoFooter, UserInfoForm, UserInfoHeader } from '@/components/UserKyc';
import {
  KycMode,
  RainConsumerType,
  type UserInfoFormData,
  userInfoSchema,
} from '@/components/UserKyc/types';
import { path } from '@/constants/path';
import { TRACKING_EVENTS } from '@/constants/tracking-events';
import { track } from '@/lib/analytics';
import { createKycLink } from '@/lib/api';
import { EXPO_PUBLIC_PERSONA_RAIN_TEMPLATE_ID } from '@/lib/config';
import { withRefreshToken } from '@/lib/utils';
import { startKycFlow } from '@/lib/utils/kyc';
import { useKycStore } from '@/store/useKycStore';

// Main Component
export default function UserKycInfo() {
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const setKycLinkId = useKycStore(state => state.setKycLinkId);

  // redirectUri tells where to resume after KYC.
  const params = useLocalSearchParams<{
    redirectUri?: string;
    endorsement?: string;
    kycMode?: KycMode;
    /** Rain: 'us' = US Consumer (5 checkboxes), 'international' or absent = International (4) */
    consumerType?: RainConsumerType;
  }>();

  const { redirectUri, kycMode, consumerType } = params;
  const isUS = consumerType === RainConsumerType.US;

  // Track page view on mount
  useEffect(() => {
    track(TRACKING_EVENTS.USER_KYC_INFO_PAGE_VIEWED, {
      kyc_mode: kycMode || 'unknown',
      consumer_type: consumerType || RainConsumerType.INTERNATIONAL,
      has_redirect_uri: !!redirectUri,
    });
  }, [kycMode, consumerType, redirectUri]);

  const schema = userInfoSchema.superRefine((data, ctx) => {
    if ((kycMode as KycMode) !== KycMode.CARD) return;
    if (data.agreedToEsign !== true) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'You must agree to the E-Sign Consent to continue',
        path: ['agreedToEsign'],
      });
    }
    if (isUS && data.agreedToAccountOpeningPrivacy !== true) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'You must accept the Account Opening Privacy Notice to continue',
        path: ['agreedToAccountOpeningPrivacy'],
      });
    }
    if (data.agreedToCertify !== true) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'You must certify that the information provided is accurate',
        path: ['agreedToCertify'],
      });
    }
    if (data.agreedToNoSolicitation !== true) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'You must acknowledge that applying does not constitute unauthorized solicitation',
        path: ['agreedToNoSolicitation'],
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
      agreedToAccountOpeningPrivacy: false,
      agreedToCertify: false,
      agreedToNoSolicitation: false,
    },
  });

  const getRedirectUrl = () => {
    const baseUrl = process.env.EXPO_PUBLIC_BASE_URL;
    return (redirectUri as string) || `${baseUrl}`;
  };

  const onSubmit = async (data: UserInfoFormData) => {
    setIsLoading(true);

    // Track form submission
    track(TRACKING_EVENTS.USER_KYC_INFO_FORM_STARTED, {
      kyc_mode: kycMode || 'unknown',
      consumer_type: consumerType || RainConsumerType.INTERNATIONAL,
      has_email: !!data.email,
      has_full_name: !!data.fullName,
      agreed_to_terms: data.agreedToTerms,
      agreed_to_esign: data.agreedToEsign,
      agreed_to_account_opening_privacy: data.agreedToAccountOpeningPrivacy,
      agreed_to_certify: data.agreedToCertify,
      agreed_to_no_solicitation: data.agreedToNoSolicitation,
    });

    const redirectUrl = getRedirectUrl();
    console.warn('redirectUrl', redirectUrl);

    try {
      const kycLink = await getKycLink(redirectUrl, data);

      if (!kycLink) {
        throw new Error('An error occurred while creating the KYC link');
      }

      if (kycLink.kycLinkId) setKycLinkId(kycLink.kycLinkId);

      // Rain: backend returns empty link; Persona is started via template ID only (token sharing).
      if (!kycLink.link && EXPO_PUBLIC_PERSONA_RAIN_TEMPLATE_ID) {
        const baseUrl = process.env.EXPO_PUBLIC_BASE_URL ?? '';
        router.push({
          pathname: '/kyc',
          params: {
            mode: 'rain',
            templateId: EXPO_PUBLIC_PERSONA_RAIN_TEMPLATE_ID,
            redirectUri: redirectUrl || `${baseUrl}${path.CARD_ACTIVATE}`,
          },
        });
      } else {
        startKycFlow({ router, kycLink: kycLink.link });
      }
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
      <View className="mx-auto w-full max-w-lg flex-1 px-6 pt-8">
        <View className="flex-row items-center justify-between">
          <Pressable onPress={() => router.back()} className="web:hover:opacity-70">
            <ArrowLeft color="white" />
          </Pressable>
          <Text className="text-center text-xl font-semibold text-white md:text-2xl">
            Identity verification
          </Text>
          <View className="w-10" />
        </View>

        <View className="mb-32 mt-8 flex-1 justify-evenly">
          <UserInfoHeader kycMode={kycMode as any} />

          <UserInfoForm control={control} errors={errors} />

          <UserInfoFooter
            control={control}
            errors={errors}
            onContinue={handleSubmit(onSubmit)}
            isValid={isValid}
            isLoading={isLoading}
            kycMode={kycMode as KycMode}
            consumerType={consumerType as RainConsumerType | undefined}
          />
        </View>
      </View>
    </PageLayout>
  );

  async function getKycLink(redirectUrl: string, data: UserInfoFormData) {
    const endorsements = params.endorsement ? [params.endorsement] : [];

    const agreements =
      (kycMode as KycMode) === KycMode.CARD
        ? {
            agreedToEsign: data.agreedToEsign === true,
            agreedToTerms: data.agreedToTerms === true,
            ...(isUS && {
              agreedToAccountOpeningPrivacy: data.agreedToAccountOpeningPrivacy === true,
            }),
            agreedToCertify: data.agreedToCertify === true,
            agreedToNoSolicitation: data.agreedToNoSolicitation === true,
          }
        : undefined;

    const newKycLink = await withRefreshToken(() =>
      createKycLink(
        data.fullName.trim(),
        data.email.trim(),
        redirectUrl,
        endorsements,
        agreements,
        (consumerType as RainConsumerType) || undefined,
      ),
    );

    if (!newKycLink) throw new Error('Failed to create KYC link');

    return {
      kycLinkId: newKycLink.kycLinkId,
      link: newKycLink.link,
    };
  }
}
