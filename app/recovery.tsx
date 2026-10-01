import React, { useCallback, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { ActivityIndicator, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { zodResolver } from '@hookform/resolvers/zod';
import * as Sentry from '@sentry/react-native';
import { StamperType, useTurnkey } from '@turnkey/react-native-wallet-kit';
import { z } from 'zod';

import InfoError from '@/assets/images/info-error';
import { DesktopHero } from '@/components/Onboarding';
import { BackButton } from '@/components/ui/back-button';
import { Button } from '@/components/ui/button';
import Input from '@/components/ui/input';
import { OtpInput } from '@/components/ui/otp-input';
import { Text } from '@/components/ui/text';
import { path } from '@/constants/path';
import { useDimension } from '@/hooks/useDimension';
import { initRecoveryOtp, verifyRecoveryOtp } from '@/lib/api';
import { getAsset } from '@/lib/assets';
import { buildRecoveryPasskeyName, isTurnkeySessionError } from '@/lib/utils/passkey';
import { selectLastKnownIdentity, useUserStore } from '@/store/useUserStore';

// Validation schemas
//
// Deliberately loose: this field takes an email *or* a username, and the two
// cannot both be checked strictly here. Anything with an "@" is held to the
// email rules — a typo there is worth catching before a round trip — and
// anything else only has to be long enough to be a handle. Which account it
// names is the server's call either way.
const identifierSchema = z.object({
  identifier: z
    .string()
    .trim()
    .min(1, { error: 'Enter your email or username' })
    .refine(part => !part.includes('@') || z.email().safeParse(part).success, {
      error: 'Please enter a valid email address',
    }),
});

const otpSchema = z.object({
  otpCode: z
    .string()
    .length(6, { error: 'Verification code must be 6 digits' })
    .regex(/^\d+$/, { error: 'Verification code must only contain numbers' }),
});

type IdentifierFormData = z.infer<typeof identifierSchema>;
type OtpFormData = z.infer<typeof otpSchema>;

const STEPS = {
  EMAIL_INPUT: 'email-input',
  OTP_VERIFY: 'otp-verify',
  ADD_PASSKEY: 'add-passkey',
  SUCCESS: 'success',
} as const;

type Step = (typeof STEPS)[keyof typeof STEPS];

/**
 * The recovery session is minted from a single-use code and cannot be renewed
 * from the add-passkey screen, so it is checked before the passkey prompt
 * rather than after. The margin covers the prompt itself: creating a passkey
 * involves the platform sheet, biometrics and the password manager's own flow,
 * and a session that lapses midway leaves an orphaned passkey on the device
 * that Turnkey never registers.
 */
const SESSION_MARGIN_MS = 60 * 1000;

const SESSION_EXPIRED_MESSAGE = 'Your recovery session expired. Request a new code to continue.';

export default function RecoveryPasskey() {
  const router = useRouter();
  const { isDesktop } = useDimension();
  const { createApiKeyPair, addPasskey, storeSession, httpClient, session } = useTurnkey();
  const setCredentialIdsForIdentity = useUserStore(state => state.setCredentialIdsForIdentity);
  const lastKnownIdentity = useUserStore(selectLastKnownIdentity);

  const [step, setStep] = useState<Step>(STEPS.EMAIL_INPUT);
  const [apiError, setApiError] = useState('');
  const [loading, setLoading] = useState(false);

  // What the user typed: an email, or a username for an account whose address
  // they cannot remember — or which has none.
  const [identifier, setIdentifier] = useState('');
  // Where the code actually went, masked by the backend. The only thing the
  // OTP step can honestly say when the recovery started from a username.
  const [emailHint, setEmailHint] = useState('');
  const [otpId, setOtpId] = useState('');
  const [recoveryData, setRecoveryData] = useState<{
    credentialBundle: string;
    userId: string;
    organizationId: string;
    expiresAt?: number;
  } | null>(null);

  // Only an address can be cross-checked on verify; a username recovery leaves
  // the account to be resolved from the challenge the backend issued.
  const verifiedEmail = identifier.includes('@') ? identifier : undefined;

  // Step 1: Send OTP to the account's email via backend
  const handleSendOtp = useCallback(async (data: IdentifierFormData) => {
    setLoading(true);
    setApiError('');

    try {
      const response = await initRecoveryOtp(data.identifier);

      if (!response.otpId) {
        throw new Error('Failed to send verification code');
      }

      setIdentifier(data.identifier);
      // An older backend sends no hint; what they typed is then the best we
      // have, and for an email recovery it is the right answer anyway.
      setEmailHint(response.emailHint || data.identifier);
      setOtpId(response.otpId);
      setStep(STEPS.OTP_VERIFY);
    } catch (err: any) {
      console.error('Failed to send OTP:', err);
      setApiError(err?.message || 'Failed to send verification code. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  // Step 2: Verify OTP via backend and establish session
  const handleVerifyOtp = useCallback(
    async (data: OtpFormData) => {
      setLoading(true);
      setApiError('');

      try {
        // Create API key pair FIRST - this stores the private key locally
        const publicKey = await createApiKeyPair();

        if (!publicKey) {
          throw new Error('Failed to create session key');
        }

        // Verify OTP via backend - backend also calls otpLogin and returns credentialBundle
        const verifyResponse = await verifyRecoveryOtp(
          otpId,
          data.otpCode,
          verifiedEmail,
          publicKey,
        );

        if (!verifyResponse.credentialBundle) {
          throw new Error('Failed to verify code');
        }

        // Import the session using the credential bundle (JWT)
        await storeSession({ sessionToken: verifyResponse.credentialBundle });

        // Store recovery data for passkey creation
        setRecoveryData(verifyResponse);
        setStep(STEPS.ADD_PASSKEY);
      } catch (err: any) {
        console.error('Failed to verify OTP:', err);
        setApiError(err?.message || 'Invalid verification code. Please try again.');
      } finally {
        setLoading(false);
      }
    },
    [otpId, verifiedEmail, createApiKeyPair, storeSession],
  );

  // Every credential Turnkey holds for the recovered account, read with the
  // session the OTP step just established (an API key — no passkey prompt).
  //
  // Best effort: an empty list clears the pin instead of pinning the account to
  // a stale credential. That leaves the next prompt unfiltered, which still
  // works, and the next login re-pins from the credential that signs.
  const readCredentialIds = useCallback(
    async (data: { userId: string; organizationId: string }): Promise<string[]> => {
      try {
        const result = await httpClient?.getAuthenticators(
          { organizationId: data.organizationId, userId: data.userId },
          StamperType.ApiKey,
        );
        return (result?.authenticators ?? [])
          .map(authenticator => authenticator?.credentialId)
          .filter((credentialId): credentialId is string => !!credentialId);
      } catch (err) {
        console.warn('Failed to read recovered credentials:', err);
        return [];
      }
    },
    [httpClient],
  );

  // When the recovery session is gone, no retry on this screen can succeed —
  // the code that minted it was single-use. Send the user back to the OTP step,
  // where "Resend code" issues a fresh one, instead of leaving them tapping a
  // button that fails identically every time.
  const sendBackForNewCode = useCallback((message = SESSION_EXPIRED_MESSAGE) => {
    setRecoveryData(null);
    setApiError(message);
    setStep(STEPS.OTP_VERIFY);
  }, []);

  /**
   * Whether the session that has to stamp the add-passkey request is still good
   * for long enough to finish it. Prefers the SDK's own session (that is the
   * key doing the stamping) and falls back to the expiry the backend reported.
   */
  const hasUsableSession = useCallback(
    (expiresAt?: number) => {
      const deadline = session?.expiry ? session.expiry * 1000 : expiresAt;
      if (!deadline) return true; // Nothing to go on - let the request decide.
      return deadline - Date.now() > SESSION_MARGIN_MS;
    },
    [session],
  );

  // Step 3: Add new passkey
  const handleAddPasskey = useCallback(async () => {
    if (!recoveryData) {
      sendBackForNewCode('Recovery session not found. Request a new code to continue.');
      return;
    }

    // Checked before the prompt, not after: a passkey created against a dead
    // session is one Turnkey never registers, and it stays on the device.
    if (!hasUsableSession(recoveryData.expiresAt)) {
      sendBackForNewCode();
      return;
    }

    setLoading(true);
    setApiError('');

    try {
      await addPasskey({
        name: buildRecoveryPasskeyName(),
        userId: recoveryData.userId,
        organizationId: recoveryData.organizationId,
      });

      // Any credential this device remembers for the account belongs to the
      // passkey the user just recovered from losing. Those feed
      // TurnkeyProvider's `allowCredentials`, so leaving them behind pins every
      // later prompt to credentials the authenticator no longer holds — which
      // is what let a recovered account log in and then fail every action that
      // re-prompts. Replace them with what Turnkey holds now, including the
      // passkey just added.
      const credentialIds = await readCredentialIds(recoveryData);
      // `turnkeyUserId` is always present here, so the row is found whether or
      // not this recovery ever learned the address.
      setCredentialIdsForIdentity(
        { turnkeyUserId: recoveryData.userId, email: verifiedEmail },
        credentialIds,
      );

      setStep(STEPS.SUCCESS);
    } catch (err: any) {
      console.error('Failed to add passkey:', err);

      // `addPasskey` reports every failure downstream of the passkey prompt as
      // a bare "Failed to add passkey" - the underlying Turnkey error only
      // exists on `cause`. Report it, or this step stays undiagnosable: the
      // signup passkey flow is instrumented and this one was not, so none of
      // these failures reached Sentry at all.
      Sentry.captureException(err, {
        tags: { type: 'recovery_passkey_creation_error', turnkey_error_code: err?.code },
        extra: {
          identifier,
          turnkeyUserId: recoveryData.userId,
          organizationId: recoveryData.organizationId,
          cause: err?.cause?.message,
          sessionExpiry: session?.expiry,
        },
      });

      if (isTurnkeySessionError(err)) {
        sendBackForNewCode();
        return;
      }

      setApiError(err?.message || 'Failed to create passkey. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [
    addPasskey,
    recoveryData,
    readCredentialIds,
    setCredentialIdsForIdentity,
    identifier,
    verifiedEmail,
    hasUsableSession,
    sendBackForNewCode,
    session,
  ]);

  // Resend OTP
  const handleResendOtp = useCallback(async () => {
    setLoading(true);
    setApiError('');

    try {
      const response = await initRecoveryOtp(identifier);

      if (!response.otpId) {
        throw new Error('Failed to resend verification code');
      }

      setOtpId(response.otpId);
    } catch (err: any) {
      console.error('Failed to resend OTP:', err);
      setApiError(err?.message || 'Failed to resend code. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [identifier]);

  const handleBack = useCallback(() => {
    router.replace(path.ONBOARDING);
  }, [router]);

  // Active step's form content - shared between mobile and desktop layouts.
  const stepContent = (
    <View className="w-full max-w-[440px]">
      {step === STEPS.EMAIL_INPUT && (
        <IdentifierInput
          onSubmit={handleSendOtp}
          loading={loading}
          apiError={apiError}
          initialValue={lastKnownIdentity}
        />
      )}
      {step === STEPS.OTP_VERIFY && (
        <OtpVerify
          emailHint={emailHint}
          onSubmit={handleVerifyOtp}
          onResend={handleResendOtp}
          loading={loading}
          apiError={apiError}
        />
      )}
      {step === STEPS.ADD_PASSKEY && (
        <AddPasskey onSubmit={handleAddPasskey} loading={loading} error={apiError} />
      )}
      {step === STEPS.SUCCESS && <Success />}
    </View>
  );

  // Mobile Layout
  if (!isDesktop) {
    return (
      <SafeAreaView className="flex-1 bg-background text-foreground">
        <View className="flex-1">
          {/* Header with back button */}
          <View className="flex-row items-center px-6 py-3">
            <BackButton onPress={handleBack} />
          </View>

          {/* Content - centered vertically */}
          <View className="flex-1 items-center justify-center px-6 pb-8">{stepContent}</View>
        </View>
      </SafeAreaView>
    );
  }

  // Desktop Layout - Split Screen
  return (
    <View className="flex-1 flex-row bg-background">
      {/* Left Section - Static hero */}
      <DesktopHero />

      {/* Right Section - Form (70%) */}
      <View className="relative flex-1">
        {/* Logo at top center */}
        <View className="absolute left-0 right-0 top-6 items-center">
          <Image
            source={getAsset('images/solid-logo-4x.png')}
            alt="Solid logo"
            style={{ width: 40, height: 44 }}
            contentFit="contain"
          />
        </View>

        {/* Form Content - centered vertically, with back button above the form */}
        <View className="flex-1 items-center justify-center px-8">
          <View className="w-full max-w-[440px]">
            <View className="mb-10">
              <BackButton onPress={handleBack} />
            </View>
            {stepContent}
          </View>
        </View>
      </View>
    </View>
  );
}

// Identifier Input Component with react-hook-form
interface IdentifierInputProps {
  onSubmit: (data: IdentifierFormData) => Promise<void>;
  loading: boolean;
  apiError: string;
  /**
   * The account this device last knew about. Someone locked out is reaching for
   * the account they were signed into here, and they are on a phone with no
   * password manager to help — the one who prompted this change opened the
   * screen twice and left both times without filling the field in.
   */
  initialValue: string;
}

function IdentifierInput({ onSubmit, loading, apiError, initialValue }: IdentifierInputProps) {
  const {
    control,
    handleSubmit,
    formState: { errors, isValid },
  } = useForm<IdentifierFormData>({
    resolver: zodResolver(identifierSchema),
    mode: 'onChange',
    defaultValues: {
      identifier: initialValue,
    },
  });

  const fieldError = errors.identifier?.message;
  const displayError = fieldError || apiError;

  return (
    <>
      <View className="mb-8">
        <Text className="mb-4 text-center text-[34px] font-medium -tracking-[1px] text-white">
          Passkey Recovery
        </Text>
        <Text className="text-center text-base font-medium text-white/60">
          We&apos;ll send a verification code{'\n'}to recover your account
        </Text>
      </View>

      <View className="mb-6 gap-5">
        <View>
          <Text className="mb-2 text-base font-medium text-white/60">Email or username</Text>
          <Controller
            control={control}
            name="identifier"
            render={({ field: { onChange, onBlur, value } }) => (
              <Input
                id="identifier"
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                placeholder="Enter your email or username"
                // Still the email keyboard: an address is the longer, more
                // error-prone thing to type, and a username is plain ASCII
                // either way.
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="username"
                className="bg-[#2F2F2F] font-normal"
                error={!!errors.identifier}
                autoCorrect={false}
                autoFocus={!initialValue}
              />
            )}
          />
          <Text className="mt-2 text-sm text-white/40">
            The code goes to the email on your account.
          </Text>
        </View>

        {displayError ? (
          <View className="flex-row items-center gap-2">
            <InfoError />
            <Text className="text-sm text-red-400">{displayError}</Text>
          </View>
        ) : null}
      </View>

      <Button
        variant="brand"
        className="h-14 w-full rounded-xl font-semibold"
        onPress={handleSubmit(onSubmit)}
        disabled={!isValid || loading}
      >
        {loading ? (
          <ActivityIndicator color="gray" />
        ) : (
          <Text className="text-base font-bold">Send code</Text>
        )}
      </Button>
    </>
  );
}

// OTP Verification Component with react-hook-form
interface OtpVerifyProps {
  /**
   * Where the code went, already masked by the backend. A recovery started
   * from a username never learns the full address, so this screen is told what
   * to show rather than deriving it.
   */
  emailHint: string;
  onSubmit: (data: OtpFormData) => Promise<void>;
  onResend: () => void;
  loading: boolean;
  apiError: string;
}

function OtpVerify({ emailHint, onSubmit, onResend, loading, apiError }: OtpVerifyProps) {
  const {
    control,
    handleSubmit,
    formState: { errors, isValid },
    reset,
  } = useForm<OtpFormData>({
    resolver: zodResolver(otpSchema),
    mode: 'onChange',
    defaultValues: {
      otpCode: '',
    },
  });

  // Masked server-side when it came from there. An older backend sends no hint
  // and this is whatever the user typed, so mask it here too.
  const maskedEmail = emailHint.includes('•')
    ? emailHint
    : emailHint.replace(/(.{2})(.*)(@.*)/, '$1***$3');
  const fieldError = errors.otpCode?.message;
  const displayError = fieldError || apiError;

  const handleResend = useCallback(() => {
    reset();
    onResend();
  }, [reset, onResend]);

  return (
    <>
      <View className="mb-8">
        <Text className="mb-4 text-center text-[34px] font-medium -tracking-[1px] text-white">
          Enter verification code
        </Text>
        <Text className="text-center text-base font-medium text-white/60">
          We sent a 6-digit code to {maskedEmail}
        </Text>
      </View>

      <View className="mb-6">
        <Controller
          control={control}
          name="otpCode"
          render={({ field: { onChange, value } }) => (
            <OtpInput
              value={value}
              onChange={onChange}
              length={6}
              autoFocus
              error={!!displayError}
              disabled={loading}
            />
          )}
        />
        {displayError ? (
          <View className="mt-4 flex-row items-center justify-center gap-2">
            <InfoError />
            <Text className="text-sm text-red-400">{displayError}</Text>
          </View>
        ) : null}
      </View>

      <Button
        variant="brand"
        className="mb-3 h-14 w-full rounded-xl font-semibold"
        onPress={handleSubmit(onSubmit)}
        disabled={!isValid || loading}
      >
        {loading ? (
          <ActivityIndicator color="gray" />
        ) : (
          <Text className="text-base font-bold">Verify</Text>
        )}
      </Button>

      <Button
        variant="ghost"
        className="h-14 w-full rounded-xl"
        onPress={handleResend}
        disabled={loading}
      >
        <Text className="text-base font-medium text-white/60">Resend code</Text>
      </Button>
    </>
  );
}

// Add Passkey Component
interface AddPasskeyProps {
  onSubmit: () => Promise<void>;
  loading: boolean;
  error: string;
}

function AddPasskey({ onSubmit, loading, error }: AddPasskeyProps) {
  return (
    <>
      <View className="mb-8">
        <Text className="mb-4 text-center text-[34px] font-medium -tracking-[1px] text-white">
          Add passkey
        </Text>
        <Text className="text-center text-base font-medium text-white/60">
          Create a new passkey to access{'\n'}your account
        </Text>
      </View>

      {error ? (
        <View className="mb-6 flex-row items-center gap-2">
          <InfoError />
          <Text className="text-sm text-red-400">{error}</Text>
        </View>
      ) : null}

      <Button
        variant="brand"
        className="h-14 w-full rounded-xl font-semibold"
        onPress={onSubmit}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="gray" />
        ) : (
          <Text className="text-base font-bold">Create passkey</Text>
        )}
      </Button>
    </>
  );
}

// Success Component
function Success() {
  const router = useRouter();
  return (
    <>
      <View className="mb-8">
        <Text className="mb-4 text-center text-[34px] font-medium -tracking-[1px] text-white">
          Success
        </Text>
        <Text className="text-center text-base font-medium text-white/60">
          Your passkey has been created{'\n'}successfully
        </Text>
      </View>

      <Button
        variant="brand"
        className="h-14 w-full rounded-xl font-semibold"
        onPress={() => router.replace(path.HOME)}
      >
        <Text className="text-base font-bold">Go to home</Text>
      </Button>
    </>
  );
}
