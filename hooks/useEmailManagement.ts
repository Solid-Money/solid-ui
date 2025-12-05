import { base64urlToUint8Array, withRefreshToken } from '@/lib/utils';
import { zodResolver } from '@hookform/resolvers/zod';
import { TurnkeyClient } from '@turnkey/http';
import { PasskeyStamper } from '@turnkey/sdk-react-native';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Alert, Platform } from 'react-native';
import Toast from 'react-native-toast-message';
import { z } from 'zod';

import { getRuntimeRpId } from '@/components/TurnkeyProvider';
import { TRACKING_EVENTS } from '@/constants/tracking-events';
import useUser from '@/hooks/useUser';
import { track } from '@/lib/analytics';
import { initGenericOtp, verifyGenericOtp } from '@/lib/api';
import {
  EXPO_PUBLIC_TURNKEY_API_BASE_URL,
  EXPO_PUBLIC_TURNKEY_ORGANIZATION_ID,
} from '@/lib/config';
import { useUserStore } from '@/store/useUserStore';

const emailSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
});

const otpSchema = z.object({
  otpCode: z
    .string()
    .length(6, 'Verification code must be 6 digits')
    .regex(/^\d+$/, 'Verification code must contain only numbers'),
});

export type EmailFormData = z.infer<typeof emailSchema>;
export type OtpFormData = z.infer<typeof otpSchema>;

export interface EmailManagementState {
  step: 'existing' | 'email' | 'otp';
  isLoading: boolean;
  otpId: string;
  emailValue: string;
  rateLimitError: string | null;
}

export interface EmailManagementActions {
  emailForm: ReturnType<typeof useForm<EmailFormData>>;
  otpForm: ReturnType<typeof useForm<OtpFormData>>;
  handleSendOtp: (data: EmailFormData) => Promise<void>;
  handleVerifyOtp: (data: OtpFormData) => Promise<void>;
  handleChangeEmail: () => void;
  handleBack: () => void;
  handleResendOtp: () => Promise<void>;
  setStep: (step: EmailManagementState['step']) => void;
  getButtonText: () => string;
  isFormDisabled: () => boolean;
  watchedEmail: string;
  watchedOtp: string;
  clearRateLimitError: () => void;
  isSkip: boolean;
  setIsSkip: (isSkip: boolean) => void;
}

export interface RecoveryState {
  hasRecoveryEmail: boolean;
  isEmailVerified: boolean;
  email?: string;
}

export interface RecoveryActions {
  checkRecoveryStatus: (userId: string, organizationId: string) => Promise<RecoveryState>;
  addRecoveryEmail: (userId: string, organizationId: string, email: string) => Promise<boolean>;
  initiateRecovery: (email: string) => Promise<boolean>;
  verifyRecovery: (token: string) => Promise<{ organizationId: string; userId: string }>;
}

export const useEmailManagement = (
  onSuccess?: () => void,
  initialStep?: 'email' | 'existing',
): EmailManagementState & EmailManagementActions => {
  const { user } = useUser();
  const { updateUser } = useUserStore();
  const [isLoading, setIsLoading] = useState(false);
  const [step, setStep] = useState<EmailManagementState['step']>(() => {
    if (initialStep) return initialStep;
    return user?.email ? 'existing' : 'email';
  });
  const [otpId, setOtpId] = useState('');
  const [emailValue, setEmailValue] = useState('');
  const [rateLimitError, setRateLimitError] = useState<string | null>(null);
  const [isSkip, setIsSkip] = useState(false);

  const emailForm = useForm<EmailFormData>({
    resolver: zodResolver(emailSchema),
    mode: 'onChange',
    defaultValues: {
      email: '',
    },
  });

  const otpForm = useForm<OtpFormData>({
    resolver: zodResolver(otpSchema),
    mode: 'onSubmit',
    defaultValues: {
      otpCode: '',
    },
  });

  const watchedEmail = emailForm.watch('email');
  const watchedOtp = otpForm.watch('otpCode');

  // Clear rate limit error when email changes
  useEffect(() => {
    if (rateLimitError) {
      setRateLimitError(null);
    }
  }, [watchedEmail]);

  const [hasInitializedOtp, setHasInitializedOtp] = useState(false);

  useEffect(() => {
    if (step === 'otp' && !hasInitializedOtp) {
      otpForm.setValue('otpCode', '');
      setHasInitializedOtp(true);
    } else if (step !== 'otp') {
      setHasInitializedOtp(false);
    }
  }, [step, hasInitializedOtp, otpForm]);

  const updateUserEmail = async (email: string, verificationToken: string) => {
    if (Platform.OS === 'web') {
      const { Turnkey } = await import('@turnkey/sdk-browser');
      const turnkey = new Turnkey({
        apiBaseUrl: EXPO_PUBLIC_TURNKEY_API_BASE_URL,
        defaultOrganizationId: EXPO_PUBLIC_TURNKEY_ORGANIZATION_ID,
        rpId: getRuntimeRpId(),
      });

      const allowCredentials = user?.credentialId
        ? [
            {
              id: base64urlToUint8Array(user.credentialId) as BufferSource,
              type: 'public-key' as const,
            },
          ]
        : undefined;

      const passkeyClient = turnkey.passkeyClient(
        allowCredentials ? { allowCredentials } : undefined,
      );
      const indexedDbClient = await turnkey.indexedDbClient();
      await indexedDbClient?.init();
      await indexedDbClient!.resetKeyPair();
      await passkeyClient?.updateUserEmail({
        userId: user?.turnkeyUserId as string,
        userEmail: email,
        organizationId: user?.suborgId,
        verificationToken,
      });
    } else {
      const stamper = new PasskeyStamper({
        rpId: getRuntimeRpId(),
        allowCredentials: user?.credentialId
          ? [
              {
                id: user.credentialId,
                type: 'public-key' as const,
              },
            ]
          : undefined,
      });

      const turnkeyClient = new TurnkeyClient(
        { baseUrl: EXPO_PUBLIC_TURNKEY_API_BASE_URL },
        stamper,
      );

      await turnkeyClient.updateUserEmail({
        type: 'ACTIVITY_TYPE_UPDATE_USER_EMAIL',
        timestampMs: Date.now().toString(),
        organizationId: user?.suborgId as string,
        parameters: {
          userId: user?.turnkeyUserId as string,
          userEmail: email,
          verificationToken,
        },
      });
    }
  };

  const handleSendOtp = async (data: EmailFormData) => {
    setIsLoading(true);
    setRateLimitError(null);

    // Track email OTP request
    track(TRACKING_EVENTS.EMAIL_OTP_REQUESTED, {
      user_id: user?.userId,
      safe_address: user?.safeAddress,
      email: data.email,
      context: initialStep === 'email' ? 'deposit_flow' : 'settings',
    });

    try {
      const response = await withRefreshToken(() => initGenericOtp(data.email, 6, false));
      setOtpId(response.otpId);
      setEmailValue(data.email);
      setStep('otp');

      // Track email submitted successfully
      track(TRACKING_EVENTS.EMAIL_SUBMITTED, {
        user_id: user?.userId,
        safe_address: user?.safeAddress,
        email: data.email,
        context: initialStep === 'email' ? 'deposit_flow' : 'settings',
      });

      if (Platform.OS !== 'web') {
        Alert.alert('OTP Sent', 'A verification code has been sent to your email address.', [
          { text: 'OK' },
        ]);
      }
    } catch (error: any) {
      const errorTitle = 'Failed to send OTP';
      let errorMessage = error?.message || error?.toString() || '';
      console.error(errorTitle, error);
      setIsSkip(true);

      // Track email verification failure
      track(TRACKING_EVENTS.EMAIL_VERIFICATION_FAILED, {
        user_id: user?.userId,
        safe_address: user?.safeAddress,
        email: data.email,
        error: errorMessage,
        error_type: 'otp_send_failed',
        context: initialStep === 'email' ? 'deposit_flow' : 'settings',
      });

      const isRateLimitError =
        errorMessage.includes('Max number of OTPs have been initiated') ||
        errorMessage.includes('please wait and try again') ||
        errorMessage.includes('Turnkey error 3');

      if (isRateLimitError) {
        setRateLimitError(
          'Too many verification codes requested. Please wait a few minutes before trying again.',
        );
      } else {
        errorMessage = 'Inspect console log for more details and try again';
        if (Platform.OS === 'web') {
          Toast.show({
            type: 'error',
            text1: errorTitle,
            text2: errorMessage,
            props: {
              badgeText: '',
            },
          });
        } else {
          Alert.alert('Error', errorMessage, [{ text: 'OK' }]);
        }
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOtp = async (data: OtpFormData) => {
    setIsLoading(true);
    try {
      const verifyResponse = await withRefreshToken(() =>
        verifyGenericOtp(otpId, data.otpCode, emailValue),
      );

      await updateUserEmail(emailValue, verifyResponse.verificationToken);

      if (updateUser) {
        updateUser({
          ...user!,
          email: emailValue,
        });
      }

      // Track successful email verification
      track(TRACKING_EVENTS.EMAIL_OTP_VERIFIED, {
        user_id: user?.userId,
        safe_address: user?.safeAddress,
        email: emailValue,
        context: initialStep === 'email' ? 'deposit_flow' : 'settings',
      });

      onSuccess?.();
    } catch (error: any) {
      let errorTitle = 'Failed to verify OTP';
      let errorMessage = 'Inspect console log for more details and try again';
      console.error(errorTitle, error);
      setIsSkip(true);

      // Track email OTP verification failure
      track(TRACKING_EVENTS.EMAIL_VERIFICATION_FAILED, {
        user_id: user?.userId,
        safe_address: user?.safeAddress,
        email: emailValue,
        error: error?.toString(),
        error_type: 'otp_verification_failed',
        context: initialStep === 'email' ? 'deposit_flow' : 'settings',
      });

      if (error?.toString().includes('SIGNATURE_INVALID')) {
        errorTitle = 'Incorrect passkey used';
        errorMessage = 'Passkey must match with the registered account';
      }

      if (Platform.OS === 'web') {
        Toast.show({
          type: 'error',
          text1: errorTitle,
          text2: errorMessage,
          props: {
            badgeText: '',
          },
        });
      } else {
        Alert.alert('Error', errorMessage, [{ text: 'OK' }]);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (!emailValue) return;
    await handleSendOtp({ email: emailValue });
  };

  const handleChangeEmail = () => {
    setStep('email');
    emailForm.reset({ email: '' });
  };

  const handleBack = () => {
    if (step === 'otp') {
      setStep('email');
      otpForm.reset();
    } else if (step === 'email' && user?.email && !initialStep) {
      setStep('existing');
    }
  };

  const getButtonText = (): string => {
    if (step === 'existing') {
      return 'Change Email';
    } else if (step === 'email') {
      if (rateLimitError) return 'Please wait before trying again';
      const errors = emailForm.formState.errors;
      if (errors.email?.message) return errors.email.message;
      if (!emailForm.formState.isValid || !watchedEmail) return 'Enter email address';
      if (isLoading) return 'Sending Code';
      return 'Send Verification Code';
    } else {
      if (!watchedOtp) return 'Enter verification code';
      if (watchedOtp.length < 6) return 'Enter 6-digit code';
      if (isLoading) return 'Verifying';
      return 'Verify & Save';
    }
  };

  const isFormDisabled = () => {
    if (step === 'existing') {
      return isLoading;
    } else if (step === 'email') {
      return !emailForm.formState.isValid || !watchedEmail || isLoading || !!rateLimitError;
    } else if (step === 'otp') {
      return !watchedOtp || watchedOtp.length !== 6 || isLoading;
    }

    return false;
  };

  const clearRateLimitError = () => {
    setRateLimitError(null);
  };

  return {
    step,
    isLoading,
    otpId,
    emailValue,
    rateLimitError,
    emailForm,
    otpForm,
    handleSendOtp,
    handleVerifyOtp,
    handleChangeEmail,
    handleBack,
    handleResendOtp,
    setStep,
    getButtonText,
    isFormDisabled,
    watchedEmail,
    watchedOtp,
    clearRateLimitError,
    isSkip,
    setIsSkip,
  };
};
