import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { View } from 'react-native';
import Toast from 'react-native-toast-message';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

import { Text } from '@/components/ui/text';
import { UserInfoFooter, UserInfoForm, UserInfoHeader } from '@/components/UserKyc';
import { KycMode, type UserInfoFormData, userInfoSchema } from '@/components/UserKyc/types';
import { DEPOSIT_MODAL } from '@/constants/modals';
import { TRACKING_EVENTS } from '@/constants/tracking-events';
import { track } from '@/lib/analytics';
import { createKycLink } from '@/lib/api';
import { useDepositStore } from '@/store/useDepositStore';

import type { ClientOptions } from 'persona';

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

      // Save KYC link data to store and mark that user came through info form
      // (used by back navigation to return here instead of payment method)
      setKycData({
        kycLink: kycLink.link,
        kycLinkId: kycLink.kycLinkId,
        enteredViaInfoForm: true,
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
    <View className="flex-1 gap-6 pb-1 pt-4">
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

// Parse KYC link URL into Persona Client options
function parseKycUrlToOptions(rawUrl: string): {
  options: ClientOptions;
  redirectUri?: string;
} {
  const parsedUrl = new URL(rawUrl);

  // Use /widget path instead of /verify when embedding (Bridge support recommendation)
  if (parsedUrl.pathname.includes('/verify')) {
    parsedUrl.pathname = parsedUrl.pathname.replace('/verify', '/widget');
  }

  // Add iframe-origin for proper embedding (Bridge support recommendation)
  if (typeof window !== 'undefined' && !parsedUrl.searchParams.has('iframe-origin')) {
    parsedUrl.searchParams.set('iframe-origin', window.location.origin);
  }

  const searchParams = parsedUrl.searchParams;

  const templateId = searchParams.get('inquiry-template-id') ?? undefined;
  const inquiryId = searchParams.get('inquiry-id') ?? undefined;
  const environmentId = searchParams.get('environment-id') ?? undefined;
  const referenceId = searchParams.get('reference-id') ?? undefined;
  const redirectUri = searchParams.get('redirect-uri') ?? undefined;

  // Collect fields[xxx]=value into a flat map
  const fields: Record<string, string> = {};

  searchParams.forEach((value, key) => {
    if (key.startsWith('fields[') && key.endsWith(']')) {
      const innerKey = key.slice('fields['.length, -1);
      if (innerKey) fields[innerKey] = value;
    }
  });

  const options: ClientOptions = {
    templateId,
    inquiryId,
    environmentId,
    referenceId,
    fields,
  };

  return { options, redirectUri };
}

// Modal version of KYC Frame using Persona SDK
const BankTransferKycFrameModal = () => {
  const { kyc, setModal, clearKycData } = useDepositStore();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const unsubscribeRef = useRef<(() => void) | null>(null);

  const handleKycSuccess = useCallback(() => {
    // Clear all data and close the modal after KYC completion
    const { clearBankTransferData } = useDepositStore.getState();
    clearKycData();
    clearBankTransferData();
    setModal(DEPOSIT_MODAL.CLOSE);
  }, [clearKycData, setModal]);

  const handleCancel = useCallback(() => {
    setModal(DEPOSIT_MODAL.CLOSE);
  }, [setModal]);

  useEffect(() => {
    let destroyed = false;
    const url = kyc.kycLink;

    if (!url) {
      setError('No KYC URL available');
      setLoading(false);
      return;
    }

    if (typeof window === 'undefined') {
      setError('KYC verification requires a browser');
      setLoading(false);
      return;
    }

    const run = async () => {
      try {
        const { options, redirectUri } = parseKycUrlToOptions(url);

        // Track parsed URL details for debugging
        track(TRACKING_EVENTS.DEPOSIT_BANK_KYC_PARSED, {
          hasTemplateId: !!options.templateId,
          hasInquiryId: !!options.inquiryId,
          hasRedirectUri: !!redirectUri,
          redirectUri,
          kycUrl: url,
        });

        // Basic validation
        if (!options.templateId && !options.inquiryId) {
          throw new Error('Invalid KYC link - missing required parameters');
        }

        const { setupIframe, setupEvents } = await import('persona');

        const containerId = 'persona-modal-' + Math.random().toString(36).slice(2);

        // Wire events with Persona SDK
        unsubscribeRef.current = setupEvents(containerId, {
          templateId: options.templateId ?? null,
          templateVersionId: (options as any).templateVersionId ?? null,
          host: (options as any).host ?? null,
          onLoad: null,
          onEvent: null,
          onReady: () => {
            if (!destroyed) setLoading(false);
          },
          onComplete: ({ inquiryId: completedInquiryId, status }) => {
            if (!destroyed) {
              track(TRACKING_EVENTS.DEPOSIT_BANK_KYC_COMPLETED, {
                inquiryId: completedInquiryId,
                status,
                hasRedirectUri: !!redirectUri,
                redirectUri,
                kycUrl: url,
              });
              handleKycSuccess();
            }
          },
          onCancel: () => {
            if (!destroyed) {
              track(TRACKING_EVENTS.DEPOSIT_BANK_KYC_CANCELLED, {
                kycUrl: url,
              });
              handleCancel();
            }
          },
          onError: e => {
            if (!destroyed) {
              track(TRACKING_EVENTS.DEPOSIT_BANK_KYC_ERROR, {
                error: e?.message || 'Verification error occurred',
                kycUrl: url,
              });
              setError(e?.message || 'Verification error occurred');
              setLoading(false);
            }
          },
        });

        // Mount inline iframe
        if (iframeRef.current && !destroyed) {
          setupIframe(iframeRef.current, containerId, 'inline', {
            ...options,
            frameWidth: '100%',
            frameHeight: '100%',
          });
        }
      } catch (e: any) {
        if (!destroyed) {
          setError(e?.message || 'Failed to load verification');
          setLoading(false);
        }
      }
    };

    run();

    return () => {
      destroyed = true;
      try {
        unsubscribeRef.current?.();
      } catch (_e) {}
      unsubscribeRef.current = null;
    };
  }, [kyc.kycLink, handleKycSuccess, handleCancel]);

  return (
    <div style={{ height: '70vh', width: '100%', overflow: 'hidden' }}>
      {loading && (
        <View className="h-full items-center justify-center">
          <Text className="text-white">Loading verification...</Text>
        </View>
      )}

      {error ? (
        <View className="h-full items-center justify-center">
          <Text className="text-center text-red-500">{error}</Text>
        </View>
      ) : (
        <iframe
          ref={iframeRef}
          style={{ width: '100%', height: '100%', border: 'none' }}
          title="KYC Verification"
        />
      )}
    </div>
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
