import InfoError from '@/assets/images/info-error';
import { Button } from '@/components/ui/button';
import Input from '@/components/ui/input';
import { OtpInput } from '@/components/ui/otp-input';
import { Text } from '@/components/ui/text';
import { path } from '@/constants/path';
import { initRecoveryOtp, verifyRecoveryOtp } from '@/lib/api';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTurnkey } from '@turnkey/react-native-wallet-kit';
import { useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { ActivityIndicator, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { z } from 'zod';

// Validation schemas
const emailSchema = z.object({
  email: z.email({ error: 'Please enter a valid email address' }),
});

const otpSchema = z.object({
  otpCode: z
    .string()
    .length(6, { error: 'Verification code must be 6 digits' })
    .regex(/^\d+$/, { error: 'Verification code must only contain numbers' }),
});

type EmailFormData = z.infer<typeof emailSchema>;
type OtpFormData = z.infer<typeof otpSchema>;

const STEPS = {
  EMAIL_INPUT: 'email-input',
  OTP_VERIFY: 'otp-verify',
  ADD_PASSKEY: 'add-passkey',
  SUCCESS: 'success',
} as const;

type Step = (typeof STEPS)[keyof typeof STEPS];

export default function RecoveryPasskey() {
  const { createApiKeyPair, addPasskey, storeSession } = useTurnkey();

  const [step, setStep] = useState<Step>(STEPS.EMAIL_INPUT);
  const [apiError, setApiError] = useState('');
  const [loading, setLoading] = useState(false);

  const [email, setEmail] = useState('');
  const [otpId, setOtpId] = useState('');
  const [recoveryData, setRecoveryData] = useState<{
    credentialBundle: string;
    userId: string;
    organizationId: string;
  } | null>(null);

  // Step 1: Send OTP to user's email via backend
  const handleSendOtp = useCallback(async (data: EmailFormData) => {
    setLoading(true);
    setApiError('');

    try {
      const response = await initRecoveryOtp(data.email);

      if (!response.otpId) {
        throw new Error('Failed to send verification code');
      }

      setEmail(data.email);
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
        const verifyResponse = await verifyRecoveryOtp(otpId, data.otpCode, email, publicKey);

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
    [otpId, email, createApiKeyPair, storeSession],
  );

  // Step 3: Add new passkey
  const handleAddPasskey = useCallback(async () => {
    setLoading(true);
    setApiError('');

    try {
      if (!recoveryData) {
        throw new Error('Recovery data not found');
      }

      await addPasskey({
        name: `Recovery Passkey - ${new Date().toLocaleDateString()}`,
        userId: recoveryData.userId,
        organizationId: recoveryData.organizationId,
      });

      setStep(STEPS.SUCCESS);
    } catch (err: any) {
      console.error('Failed to add passkey:', err);
      setApiError(err?.message || 'Failed to create passkey. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [addPasskey, recoveryData]);

  // Resend OTP
  const handleResendOtp = useCallback(async () => {
    setLoading(true);
    setApiError('');

    try {
      const response = await initRecoveryOtp(email);

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
  }, [email]);

  return (
    <SafeAreaView className="flex-1 bg-background text-foreground">
      <View className="mx-auto w-full max-w-lg px-4 pt-12">
        <Text className="mb-8 text-center text-xl font-semibold text-white md:text-2xl">
          Passkey Recovery
        </Text>
        {step === STEPS.EMAIL_INPUT && (
          <EmailInput onSubmit={handleSendOtp} loading={loading} apiError={apiError} />
        )}
        {step === STEPS.OTP_VERIFY && (
          <OtpVerify
            email={email}
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
    </SafeAreaView>
  );
}

// Email Input Component with react-hook-form
interface EmailInputProps {
  onSubmit: (data: EmailFormData) => Promise<void>;
  loading: boolean;
  apiError: string;
}

function EmailInput({ onSubmit, loading, apiError }: EmailInputProps) {
  const {
    control,
    handleSubmit,
    formState: { errors, isValid },
  } = useForm<EmailFormData>({
    resolver: zodResolver(emailSchema),
    mode: 'onChange',
    defaultValues: {
      email: '',
    },
  });

  const fieldError = errors.email?.message;
  const displayError = fieldError || apiError;

  return (
    <View className="flex-1 justify-center">
      <View className="w-full max-w-md rounded-xl bg-[#1C1C1C] p-8">
        <Text className="mb-2 text-center text-2xl font-semibold text-white">Enter your email</Text>
        <Text className="mb-6 text-center text-sm text-white/60">
          We&apos;ll send a verification code to recover your account
        </Text>

        <Controller
          control={control}
          name="email"
          render={({ field: { onChange, onBlur, value } }) => (
            <Input
              id="email"
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              placeholder="Enter your email"
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              className="bg-[#2F2F2F] font-normal"
              error={!!errors.email}
              autoCorrect={false}
              autoFocus
            />
          )}
        />
        {displayError && (
          <View className="mb-4 flex-row items-center gap-2">
            <InfoError />
            <Text className="text-sm text-red-400">{displayError}</Text>
          </View>
        )}
        <Button
          className="mb-4 h-11 w-full rounded-xl bg-[#94F27F]"
          onPress={handleSubmit(onSubmit)}
          disabled={!isValid || loading}
        >
          {loading ? (
            <ActivityIndicator color="gray" />
          ) : (
            <Text className="text-base font-bold text-black">Send Code</Text>
          )}
        </Button>
      </View>
    </View>
  );
}

// OTP Verification Component with react-hook-form
interface OtpVerifyProps {
  email: string;
  onSubmit: (data: OtpFormData) => Promise<void>;
  onResend: () => void;
  loading: boolean;
  apiError: string;
}

function OtpVerify({ email, onSubmit, onResend, loading, apiError }: OtpVerifyProps) {
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

  const maskedEmail = email.replace(/(.{2})(.*)(@.*)/, '$1***$3');
  const fieldError = errors.otpCode?.message;
  const displayError = fieldError || apiError;

  const handleResend = useCallback(() => {
    reset();
    onResend();
  }, [reset, onResend]);

  return (
    <View className="flex-1 justify-center">
      <View className="w-full max-w-md rounded-xl bg-[#1C1C1C] p-8">
        <Text className="mb-2 text-center text-2xl font-semibold text-white">
          Enter verification code
        </Text>
        <Text className="mb-6 text-center text-sm text-white/60">
          We sent a 6-digit code to {maskedEmail}
        </Text>

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
          {displayError && (
            <View className="mt-4 flex-row items-center justify-center gap-2">
              <InfoError />
              <Text className="text-sm text-red-400">{displayError}</Text>
            </View>
          )}
        </View>
        <Button
          className="mb-4 h-11 w-full rounded-xl bg-[#94F27F]"
          onPress={handleSubmit(onSubmit)}
          disabled={!isValid || loading}
        >
          {loading ? (
            <ActivityIndicator color="gray" />
          ) : (
            <Text className="text-base font-bold text-black">Verify</Text>
          )}
        </Button>

        <Button
          className="h-11 w-full rounded-xl bg-transparent"
          onPress={handleResend}
          disabled={loading}
        >
          <Text className="text-base text-white/60">Resend Code</Text>
        </Button>
      </View>
    </View>
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
    <View className="flex-1 justify-center">
      <View className="w-full max-w-md rounded-xl bg-[#1C1C1C] p-8">
        <Text className="mb-2 text-center text-2xl font-semibold text-white">Add Passkey</Text>
        <Text className="mb-6 text-center text-sm text-white/60">
          Create a new passkey to access your account
        </Text>

        <Button
          className="mb-4 h-11 w-full rounded-xl bg-[#94F27F]"
          onPress={onSubmit}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="gray" />
          ) : (
            <Text className="text-base font-bold text-black">Create Passkey</Text>
          )}
        </Button>
        {error && (
          <View className="mb-4 flex-row items-center gap-2">
            <InfoError />
            <Text className="text-sm text-red-400">{error}</Text>
          </View>
        )}
      </View>
    </View>
  );
}

// Success Component
function Success() {
  const router = useRouter();
  return (
    <View className="flex-1 justify-center">
      <View className="w-full max-w-md rounded-xl bg-[#1C1C1C] p-8">
        <Text className="mb-2 text-center text-2xl font-semibold text-white">Success</Text>
        <Text className="mb-6 text-center text-sm text-white/60">
          Your passkey has been created successfully
        </Text>

        <Button
          className="mb-4 h-11 w-full rounded-xl bg-[#94F27F]"
          onPress={() => router.push(path.HOME)}
        >
          <Text className="text-base font-bold text-black">Home</Text>
        </Button>
      </View>
    </View>
  );
}
