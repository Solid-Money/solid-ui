import React, { useCallback, useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Pressable, View } from 'react-native';
import Toast from 'react-native-toast-message';
import { useRouter } from 'expo-router';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft } from 'lucide-react-native';

import PageLayout from '@/components/PageLayout';
import {
  type RainKycDocumentFiles,
  RainKycForm,
  type RainKycFormData,
  rainKycFormSchema,
} from '@/components/RainKyc';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { path } from '@/constants/path';
import { TRACKING_EVENTS } from '@/constants/tracking-events';
import { track } from '@/lib/analytics';
import { getCardStatus, getClientIp, submitRainKyc } from '@/lib/api';
import { redirectToRainVerification } from '@/lib/rainVerification';
import { KycStatus, RainApplicationStatus, type RainDocumentType } from '@/lib/types';
import { withRefreshToken } from '@/lib/utils';
import { useKycStore } from '@/store/useKycStore';

const RAIN_STATUS_TO_KYC: Record<RainApplicationStatus, KycStatus | null> = {
  approved: KycStatus.APPROVED,
  pending: KycStatus.UNDER_REVIEW,
  manualReview: KycStatus.UNDER_REVIEW,
  denied: KycStatus.REJECTED,
  locked: KycStatus.UNDER_REVIEW,
  canceled: KycStatus.REJECTED,
  needsVerification: KycStatus.INCOMPLETE,
  needsInformation: KycStatus.INCOMPLETE,
  notStarted: KycStatus.NOT_STARTED,
};

const defaultDocumentFiles: RainKycDocumentFiles = {
  idDocumentType: 'passport',
  idDocument: null,
  idDocumentFront: null,
  idDocumentBack: null,
  selfie: null,
};

export default function Kyc() {
  const router = useRouter();
  const setRainKycStatus = useKycStore(state => state.setRainKycStatus);
  const [documentFiles, setDocumentFiles] = useState<RainKycDocumentFiles>(defaultDocumentFiles);
  const [submitting, setSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState<{
    status: RainApplicationStatus;
    verificationLink?: { url: string; params: Record<string, string> };
  } | null>(null);
  const [polling, setPolling] = useState(false);

  const {
    control,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<RainKycFormData>({
    resolver: zodResolver(rainKycFormSchema),
    mode: 'onChange',
    defaultValues: {
      firstName: '',
      lastName: '',
      birthDate: '',
      nationalId: '',
      countryOfIssue: '',
      email: '',
      street: '',
      city: '',
      region: '',
      postalCode: '',
      country: '',
      occupation: '',
      annualSalary: '',
      accountPurpose: '',
      expectedMonthlyVolume: '',
      phoneCountryCode: '',
      phoneNumber: '',
      isTermsOfServiceAccepted: false,
      agreedToEsign: false,
      agreedToAccountOpeningPrivacy: false,
      agreedToCertify: false,
      agreedToNoSolicitation: false,
      idDocumentType: 'passport',
    },
  });

  const buildFormData = useCallback(
    async (data: RainKycFormData): Promise<FormData> => {
      const formData = new FormData();
      formData.append('firstName', data.firstName);
      formData.append('lastName', data.lastName);
      formData.append('birthDate', data.birthDate);
      formData.append('nationalId', data.nationalId);
      formData.append('countryOfIssue', data.countryOfIssue);
      formData.append('email', data.email);
      formData.append('street', data.street);
      formData.append('city', data.city);
      formData.append('region', data.region);
      formData.append('postalCode', data.postalCode);
      formData.append('country', data.country);
      formData.append('occupation', data.occupation);
      formData.append('annualSalary', data.annualSalary);
      formData.append('accountPurpose', data.accountPurpose);
      formData.append('expectedMonthlyVolume', data.expectedMonthlyVolume);
      formData.append('isTermsOfServiceAccepted', String(data.isTermsOfServiceAccepted === true));
      formData.append('agreedToEsign', String(data.agreedToEsign === true));
      formData.append(
        'agreedToAccountOpeningPrivacy',
        String(data.agreedToAccountOpeningPrivacy === true),
      );
      formData.append('agreedToCertify', String(data.agreedToCertify === true));
      formData.append('agreedToNoSolicitation', String(data.agreedToNoSolicitation === true));
      const ip = await getClientIp();
      if (ip) formData.append('ipAddress', ip);
      formData.append('phoneCountryCode', data.phoneCountryCode);
      formData.append('phoneNumber', data.phoneNumber);

      formData.append('idDocumentType', data.idDocumentType);
      if (data.idDocumentType === 'passport' && documentFiles.idDocument) {
        formData.append('idDocument', documentFiles.idDocument);
      } else {
        if (documentFiles.idDocumentFront) {
          formData.append('idDocumentFront', documentFiles.idDocumentFront);
          formData.append('idDocumentFrontSide', 'front');
        }
        if (documentFiles.idDocumentBack) {
          formData.append('idDocumentBack', documentFiles.idDocumentBack);
          formData.append('idDocumentBackSide', 'back');
        }
      }
      if (documentFiles.selfie) {
        formData.append('selfie', documentFiles.selfie);
      }
      return formData;
    },
    [documentFiles],
  );

  const onSubmit = useCallback(
    async (data: RainKycFormData) => {
      const isPassport = data.idDocumentType === 'passport';
      if (isPassport && !documentFiles.idDocument) {
        Toast.show({
          type: 'error',
          text1: 'Upload required',
          text2: 'Please upload your passport',
        });
        return;
      }
      if (!isPassport && (!documentFiles.idDocumentFront || !documentFiles.idDocumentBack)) {
        Toast.show({
          type: 'error',
          text1: 'Upload required',
          text2: 'Please upload front and back of ID document',
        });
        return;
      }
      if (!documentFiles.selfie) {
        Toast.show({
          type: 'error',
          text1: 'Upload required',
          text2: 'Please upload a selfie',
        });
        return;
      }

      setSubmitting(true);
      track(TRACKING_EVENTS.KYC_LINK_PAGE_LOADED, { mode: 'rain_submit' });
      try {
        const formData = await buildFormData(data);
        const res = await withRefreshToken(() => submitRainKyc(formData));
        if (!res) return;

        setSubmitResult({
          status: res.applicationStatus,
          verificationLink: res.applicationExternalVerificationLink,
        });

        const kycStatus = RAIN_STATUS_TO_KYC[res.applicationStatus];
        if (kycStatus) setRainKycStatus(kycStatus);

        if (res.applicationStatus === 'approved') {
          router.replace(String(path.CARD_ACTIVATE) as any);
          return;
        }
        if (
          res.applicationStatus === 'needsVerification' &&
          res.applicationExternalVerificationLink
        ) {
          redirectToRainVerification(res.applicationExternalVerificationLink);
          return;
        }
        if (res.applicationStatus === 'pending' || res.applicationStatus === 'manualReview') {
          setPolling(true);
        }
      } catch (e: any) {
        const message =
          e?.message || (e instanceof Response ? 'Submission failed' : 'Something went wrong');
        Toast.show({
          type: 'error',
          text1: 'Error',
          text2: message,
        });
      } finally {
        setSubmitting(false);
      }
    },
    [buildFormData, documentFiles, router, setRainKycStatus],
  );

  // Poll card status when pending/manualReview (rain status comes from card status)
  useEffect(() => {
    if (!polling) return;
    const t = setInterval(async () => {
      try {
        const cardRes = await withRefreshToken(() => getCardStatus());
        if (!cardRes?.rainApplicationStatus) return;
        const status = cardRes.rainApplicationStatus;
        const kycStatus = RAIN_STATUS_TO_KYC[status];
        if (kycStatus) setRainKycStatus(kycStatus);
        setSubmitResult(prev => ({
          ...prev!,
          status,
          verificationLink: cardRes.applicationExternalVerificationLink,
        }));
        if (status === 'approved') {
          setPolling(false);
          router.replace(path.CARD_ACTIVATE as any);
        }
        if (status === 'denied') {
          setPolling(false);
        }
        if (status === 'needsVerification' && cardRes.applicationExternalVerificationLink) {
          setPolling(false);
          redirectToRainVerification(cardRes.applicationExternalVerificationLink);
        }
      } catch {
        // ignore poll errors
      }
    }, 5000);
    return () => clearInterval(t);
  }, [polling, router, setRainKycStatus]);

  const handleFileSelect = useCallback(
    (key: 'idDocument' | 'idDocumentFront' | 'idDocumentBack' | 'selfie', file: File | null) => {
      setDocumentFiles(prev => ({ ...prev, [key]: file ?? undefined }));
    },
    [],
  );

  const handleIdDocumentTypeChange = useCallback(
    (type: RainDocumentType) => {
      if (type === 'selfie') return;
      setDocumentFiles(prev => ({
        ...prev,
        idDocumentType: type,
        idDocument: type === 'passport' ? prev.idDocument : undefined,
        idDocumentFront: type !== 'passport' ? prev.idDocumentFront : undefined,
        idDocumentBack: type !== 'passport' ? prev.idDocumentBack : undefined,
      }));
      setValue('idDocumentType', type);
    },
    [setValue],
  );

  return (
    <PageLayout desktopOnly>
      <View className="mx-auto w-full max-w-lg flex-1 gap-8 px-4 pt-8">
        <View className="flex-row items-center justify-between">
          <Pressable
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
            className="flex h-10 w-10 items-center justify-center rounded-full border-0 bg-popover web:transition-colors web:hover:bg-muted"
          >
            <ArrowLeft size={24} color="#FFFFFF" />
          </Pressable>
          <Text className="text-center text-xl font-semibold text-white md:text-2xl">
            Verify identity
          </Text>
          <View style={{ width: 40 }} />
        </View>

        {submitResult?.status === 'pending' || submitResult?.status === 'manualReview' ? (
          <View className="mt-8 flex-1 items-center justify-center">
            <Text className="text-center text-lg text-white">
              Your information is being reviewed. This usually takes a few minutes.
            </Text>
            {polling && <Text className="mt-2 text-sm text-[#ACACAC]">Checking status...</Text>}
          </View>
        ) : submitResult?.status === 'denied' ? (
          <View className="mt-8 flex-1">
            <Text className="text-center text-lg text-red-500">
              We couldn&apos;t verify your identity. Please contact support or try again.
            </Text>
          </View>
        ) : (
          <>
            <RainKycForm
              control={control as any}
              errors={errors as any}
              documentFiles={documentFiles}
              onIdDocumentTypeChange={handleIdDocumentTypeChange}
              onFileSelect={handleFileSelect}
            />
            <View className="pb-8 pt-4">
              <Button
                variant="brand"
                onPress={handleSubmit(onSubmit)}
                disabled={submitting}
                className="h-14 w-full rounded-xl"
              >
                <Text className="text-lg font-semibold text-primary-foreground">
                  {submitting ? 'Submitting...' : 'Submit'}
                </Text>
              </Button>
            </View>
          </>
        )}
      </View>
    </PageLayout>
  );
}
