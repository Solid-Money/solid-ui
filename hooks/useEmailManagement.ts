import { useCallback, useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Alert, Platform } from 'react-native';
import { zodResolver } from '@hookform/resolvers/zod';
import { StamperType, useTurnkey } from '@turnkey/react-native-wallet-kit';
import { z } from 'zod';
import { useShallow } from 'zustand/react/shallow';

import {
  BOT_CHECK_FAILED_CODE,
  BOT_CHECK_FAILED_MESSAGE,
  EMAIL_ALREADY_LINKED_CODE,
  EMAIL_ALREADY_LINKED_MESSAGE,
  EMAIL_CHANGE_CONFIRM_FAILED_CODE,
  EMAIL_CHANGE_STEP_UP_REQUIRED_CODE,
  EMAIL_DOMAIN_NOT_ALLOWED_CODE,
  EMAIL_DOMAIN_NOT_ALLOWED_MESSAGE,
  isRateLimitedError,
} from '@/constants/errors';
import { TRACKING_EVENTS } from '@/constants/tracking-events';
import useUser from '@/hooks/useUser';
import { track } from '@/lib/analytics';
import { confirmEmailChange, initGenericOtp, verifyGenericOtp } from '@/lib/api';
import { sanitizeTechnicalMessage, showErrorToast } from '@/lib/errors';
import { SignedTurnkeyRequest } from '@/lib/types';
import { withRefreshToken } from '@/lib/utils';
import { useUserStore } from '@/store/useUserStore';

/**
 * A code the backend has verified, waiting for the account's passkey to sign
 * the change. Kept so a dismissed or failed passkey prompt can be retried
 * without a new code: the code itself is spent the moment it verifies.
 */
interface PendingEmailConfirmation {
  otpId: string;
  email: string;
  verificationToken: string;
}

const emailSchema = z.object({
  email: z.email({ error: 'Please enter a valid email address' }),
});

const otpSchema = z.object({
  otpCode: z
    .string()
    // .length(6, { error: 'Verification code must be 6 digits' })
    .regex(/^\d+$/, { error: 'Verification code must contain only numbers' }),
});

export type EmailFormData = z.infer<typeof emailSchema>;
export type OtpFormData = z.infer<typeof otpSchema>;

export interface EmailManagementState {
  step: 'existing' | 'email' | 'otp' | 'success';
  isLoading: boolean;
  otpId: string;
  emailValue: string;
  rateLimitError: string | null;
  /**
   * When the newly saved email can be used to recover the account. A changed
   * address waits before it can (SEC-010); absent when it already can.
   */
  recoveryAvailableAt: Date | null;
  /** The code is verified and only the passkey confirmation is left. */
  awaitingPasskey: boolean;
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
  const updateUser = useUserStore(state => state.updateUser);
  const [isLoading, setIsLoading] = useState(false);
  const [step, setStep] = useState<EmailManagementState['step']>(() => {
    if (initialStep) return initialStep;
    return user?.email ? 'existing' : 'email';
  });
  const [otpId, setOtpId] = useState('');
  const [emailValue, setEmailValue] = useState('');
  const [rateLimitError, setRateLimitError] = useState<string | null>(null);
  const [isSkip, setIsSkip] = useState(false);
  const [pendingConfirmation, setPendingConfirmation] = useState<PendingEmailConfirmation | null>(
    null,
  );
  const [recoveryAvailableAt, setRecoveryAvailableAt] = useState<Date | null>(null);
  const { createHttpClient } = useTurnkey();

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

  /**
   * Confirm the change with the account's passkey.
   *
   * The passkey signs Turnkey's UPDATE_USER_EMAIL, but the signed request goes
   * to our backend rather than straight to Turnkey: the backend relays it and
   * only saves the address once Turnkey accepts the signature. That is what
   * stops a session token alone (a forged request, a leaked token) from moving
   * the email an account recovers through.
   */
  const confirmWithPasskey = useCallback(
    async ({ otpId: pendingOtpId, email, verificationToken }: PendingEmailConfirmation) => {
      const passkeyClient = createHttpClient({
        defaultStamperType: StamperType.Passkey,
      });
      const signed = await passkeyClient.stampUpdateUserEmail(
        {
          userId: user?.turnkeyUserId as string,
          userEmail: email,
          organizationId: user?.suborgId,
          verificationToken,
        },
        StamperType.Passkey,
      );
      if (!signed) {
        throw new Error('Passkey is not available on this device');
      }
      return withRefreshToken(() =>
        confirmEmailChange(pendingOtpId, signed as SignedTurnkeyRequest),
      );
    },
    [createHttpClient, user?.turnkeyUserId, user?.suborgId],
  );

  /**
   * An older backend saves the address when the code verifies and never asks
   * for a confirmation; Turnkey's copy is then moved directly, as it always was.
   */
  const updateTurnkeyEmailDirectly = useCallback(
    async (email: string, verificationToken: string) => {
      const passkeyClient = createHttpClient({
        defaultStamperType: StamperType.Passkey,
      });
      await passkeyClient.updateUserEmail({
        userId: user?.turnkeyUserId as string,
        userEmail: email,
        organizationId: user?.suborgId,
        verificationToken,
      });
    },
    [createHttpClient, user?.turnkeyUserId, user?.suborgId],
  );

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
      // A new code starts over: whatever an earlier one left waiting is moot.
      setPendingConfirmation(null);
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
      const errorMessage = error?.message || error?.toString() || '';
      console.error(errorTitle, error);
      setIsSkip(true);

      // Track email verification failure
      track(TRACKING_EVENTS.EMAIL_VERIFICATION_FAILED, {
        user_id: user?.userId,
        safe_address: user?.safeAddress,
        email: data.email,
        error: sanitizeTechnicalMessage(errorMessage),
        error_type: 'otp_send_failed',
        context: initialStep === 'email' ? 'deposit_flow' : 'settings',
      });

      const isRateLimitError =
        isRateLimitedError(error) ||
        errorMessage.includes('Max number of OTPs have been initiated') ||
        errorMessage.includes('please wait and try again') ||
        errorMessage.includes('Turnkey error 3');

      if (error?.code === EMAIL_DOMAIN_NOT_ALLOWED_CODE) {
        void showErrorToast(error, {
          action: 'account',
          title: 'Use a different email',
          body: EMAIL_DOMAIN_NOT_ALLOWED_MESSAGE,
        });
      } else if (error?.code === EMAIL_ALREADY_LINKED_CODE) {
        // Refused before a code was sent; another address can work.
        void showErrorToast(error, {
          action: 'account',
          title: 'Use a different email',
          body: EMAIL_ALREADY_LINKED_MESSAGE,
        });
      } else if (error?.code === BOT_CHECK_FAILED_CODE) {
        void showErrorToast(error, {
          action: 'account',
          title: 'Couldn’t send the code',
          body: BOT_CHECK_FAILED_MESSAGE,
        });
      } else if (isRateLimitError) {
        setRateLimitError(
          'Too many verification codes requested. Please wait a few minutes before trying again.',
        );
      } else {
        // Was "Inspect console log for more details", which no user can do.
        void showErrorToast(error, {
          action: 'account',
          title: 'Couldn’t send the code',
          body: 'Check the email address and try again.',
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOtp = async (data: OtpFormData) => {
    setIsLoading(true);
    // Which half failed decides what the user is told: a wrong code, or a
    // passkey that did not confirm a code that was right.
    let phase: 'verify' | 'confirm' = 'verify';
    try {
      // A code that already verified is spent; retry only the passkey half.
      let pending =
        pendingConfirmation?.otpId === otpId && pendingConfirmation.email === emailValue
          ? pendingConfirmation
          : null;

      if (!pending) {
        const verifyResponse = await withRefreshToken(() =>
          verifyGenericOtp(otpId, data.otpCode, emailValue),
        );

        if (verifyResponse.stepUpRequired) {
          pending = {
            otpId,
            email: emailValue,
            verificationToken: verifyResponse.verificationToken,
          };
          setPendingConfirmation(pending);
        } else {
          // Older backend: the address is already saved.
          phase = 'confirm';
          await updateTurnkeyEmailDirectly(emailValue, verifyResponse.verificationToken);
          setRecoveryAvailableAt(null);
        }
      }

      if (pending) {
        phase = 'confirm';
        const confirmed = await confirmWithPasskey(pending);
        setPendingConfirmation(null);
        setRecoveryAvailableAt(
          confirmed.recoveryEmailHoldUntil ? new Date(confirmed.recoveryEmailHoldUntil) : null,
        );
      }

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

      // Transition to success state
      setStep('success');

      // Call onSuccess callback immediately for backward compatibility
      // (modals that use this hook expect immediate callback, not delayed)
      onSuccess?.();
    } catch (error: any) {
      console.error('Failed to verify OTP', error);
      setIsSkip(true);

      // Track email OTP verification failure
      track(TRACKING_EVENTS.EMAIL_VERIFICATION_FAILED, {
        user_id: user?.userId,
        safe_address: user?.safeAddress,
        email: emailValue,
        error: sanitizeTechnicalMessage(error),
        error_type: phase === 'confirm' ? 'passkey_confirmation_failed' : 'otp_verification_failed',
        context: initialStep === 'email' ? 'deposit_flow' : 'settings',
      });

      if (phase === 'confirm') {
        // The code was right; only the passkey half is left. A dismissed prompt
        // stays silent (showErrorToast drops cancellations) and can be retried.
        const expired = error?.code === EMAIL_CHANGE_STEP_UP_REQUIRED_CODE;
        if (expired) setPendingConfirmation(null);
        const wrongPasskey =
          error?.code === EMAIL_CHANGE_CONFIRM_FAILED_CODE ||
          error?.toString().includes('SIGNATURE_INVALID');
        void showErrorToast(error, {
          action: 'account',
          title: wrongPasskey ? 'Wrong passkey' : 'Couldn’t confirm with your passkey',
          body: expired
            ? 'This confirmation expired. Request a new code and try again.'
            : 'Use the passkey for this account, then try again.',
        });
      } else {
        void showErrorToast(error, {
          action: 'account',
          title: 'Couldn’t verify the code',
          body: 'Check the code and try again, or request a new one.',
        });
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
      // The code already verified; only the passkey is left to ask for.
      if (pendingConfirmation?.otpId === otpId && watchedOtp?.length === 6) {
        return isLoading ? 'Confirming' : 'Confirm with Passkey';
      }
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
    recoveryAvailableAt,
    awaitingPasskey: pendingConfirmation?.otpId === otpId,
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
