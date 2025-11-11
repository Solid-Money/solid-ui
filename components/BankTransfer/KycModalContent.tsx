import { zodResolver } from '@hookform/resolvers/zod';
import React, { useCallback, useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { View } from 'react-native';
import Toast from 'react-native-toast-message';
import { z } from 'zod';

import { Text } from '@/components/ui/text';

import { UserInfoFooter, UserInfoForm, UserInfoHeader } from '@/components/UserKyc';
import { KycMode, type UserInfoFormData, userInfoSchema } from '@/components/UserKyc/types';
import { DEPOSIT_MODAL } from '@/constants/modals';
import { createKycLink } from '@/lib/api';
import { useDepositStore } from '@/store/useDepositStore';

// Modal version of KYC Info Form
const BankTransferKycInfoModal = () => {
  const [isLoading, setIsLoading] = useState(false);
  const { kyc, setModal, setKycData } = useDepositStore();

  const kycMode = (kyc.kycMode as KycMode) || KycMode.BANK_TRANSFER;

  const schema = userInfoSchema.superRefine((data, ctx) => {
    if (kycMode === KycMode.CARD && data.agreedToEsign !== true) {
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

  const onSubmit = async (data: UserInfoFormData) => {
    setIsLoading(true);

    // Decode the redirect URI since it comes URL encoded from buildResumeRedirectUri
    const redirectUrl = kyc.redirectUri
      ? decodeURIComponent(kyc.redirectUri)
      : `${process.env.EXPO_PUBLIC_BASE_URL}`;

    try {
      const kycLink = await getKycLink(redirectUrl, data);

      if (!kycLink) {
        throw new Error('An error occurred while creating the KYC link');
      }

      // Save KYC link data to store
      setKycData({
        kycLink: kycLink.link,
        kycLinkId: kycLink.kycLinkId,
      });

      // Navigate to KYC frame modal
      setModal(DEPOSIT_MODAL.OPEN_BANK_TRANSFER_KYC_FRAME);
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

  async function getKycLink(
    redirectUrl: string,
    data: { fullName: string; email: string; agreedToTerms: boolean },
  ) {
    const endorsements = kyc.endorsement ? [kyc.endorsement] : [];

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

  return (
    <View className="flex-1 gap-6 pt-4 pb-1">
      <UserInfoHeader kycMode={kycMode} />
      <View className="px-1">
        <UserInfoForm control={control} errors={errors} />
      </View>
      <UserInfoFooter
        control={control}
        errors={errors}
        onContinue={handleSubmit(onSubmit)}
        isValid={isValid}
        isLoading={isLoading}
        kycMode={kycMode}
      />
    </View>
  );
};

// Modal version of KYC Frame (iframe)
const BankTransferKycFrameModal = () => {
  const { kyc, setModal, clearKycData } = useDepositStore();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [finalUrl, setFinalUrl] = useState<string>('');

  const handleKycSuccess = useCallback(() => {
    // Clear all data and close the modal after KYC completion - no auto-resume
    const { clearBankTransferData } = useDepositStore.getState();
    clearKycData();
    clearBankTransferData();
    setModal(DEPOSIT_MODAL.CLOSE);
  }, [clearKycData, setModal]);

  const handleIframeLoad = () => {
    setLoading(false);
  };

  const handleIframeError = () => {
    setError('Failed to load content. Please try again later.');
    setLoading(false);
  };

  // Setup message listener for KYC completion
  useEffect(() => {
    const handleMessage = async (event: MessageEvent) => {
      try {
        // Check for completion events
        if (
          event?.data &&
          typeof event.data === 'object' &&
          (event.data.status === 'completed' || event.data.event === 'verification.complete')
        ) {
          console.warn('Verification completed');
          handleKycSuccess();
        }
      } catch (err) {
        console.error('Error handling message:', err);
      }
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('message', handleMessage);
      return () => window.removeEventListener('message', handleMessage);
    }
  }, [handleKycSuccess]);

  // Process the URL to add required parameters
  useEffect(() => {
    const url = kyc.kycLink;

    if (!url) {
      setError('No KYC URL available');
      setLoading(false);
      return;
    }

    try {
      const urlObj = new URL(url);

      // If URL is from Persona and contains /verify, replace with /widget
      if (urlObj.hostname.includes('withpersona.com') && urlObj.pathname.includes('/verify')) {
        urlObj.pathname = urlObj.pathname.replace('/verify', '/widget');
      }

      // Add iframe-origin parameter for postMessage security
      if (typeof window !== 'undefined') {
        urlObj.searchParams.set('iframe-origin', window.location.origin);
      }

      setFinalUrl(urlObj.toString());
    } catch (_e) {
      setError('Invalid URL format');
      setLoading(false);
    }
  }, [kyc.kycLink]);

  return (
    <View className="flex-1 md:max-h-[65vh] lg:max-h-[70vh] 2xl:max-h-[75vh] overflow-y-auto">
      {loading && (
        <View className="flex-1 items-center justify-center">
          <Text className="text-white">Loading verification...</Text>
        </View>
      )}

      {error ? (
        <View className="flex-1 items-center justify-center">
          <Text className="text-red-500 text-center">{error}</Text>
        </View>
      ) : finalUrl ? (
        <iframe
          src={finalUrl}
          className="w-full min-h-[100vh]"
          onLoad={handleIframeLoad}
          onError={handleIframeError}
          allow="camera; microphone; geolocation"
          sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-modals allow-top-navigation"
          title="KYC Verification"
        />
      ) : null}
    </View>
  );
};

// Main component that renders the appropriate KYC step
export const KycModalContent = () => {
  const { currentModal } = useDepositStore();

  if (currentModal.name === 'open_bank_transfer_kyc_info') {
    return <BankTransferKycInfoModal />;
  }

  if (currentModal.name === 'open_bank_transfer_kyc_frame') {
    return <BankTransferKycFrameModal />;
  }

  return null;
};
