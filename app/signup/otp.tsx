import { zodResolver } from '@hookform/resolvers/zod';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { z } from 'zod';

import InfoError from '@/assets/images/info-error';
import { DesktopCarousel } from '@/components/Onboarding';
import { Button } from '@/components/ui/button';
import { OtpInput } from '@/components/ui/otp-input';
import { Text } from '@/components/ui/text';
import { path } from '@/constants/path';
import { TRACKING_EVENTS } from '@/constants/tracking-events';
import { useDimension } from '@/hooks/useDimension';
import { track } from '@/lib/analytics';
import { initSignupOtp, verifySignupOtp } from '@/lib/api';
import { useSignupFlowStore } from '@/store/useSignupFlowStore';

// OTP resend cooldown (60 seconds)
const OTP_COOLDOWN_MS = 60000;
const OTP_LENGTH = 6;

const otpSchema = z.object({
  otp: z
    .string()
    .min(1, { error: 'Please enter your verification code' })
    .regex(/^\d+$/, { error: 'Verification code must contain only numbers' })
    .length(OTP_LENGTH, { error: `Verification code must be ${OTP_LENGTH} digits` }),
});

type OtpFormData = z.infer<typeof otpSchema>;

export default function SignupOtp() {
  const router = useRouter();
  const { isDesktop } = useDimension();
  const {
    email,
    otpId,
    isLoading,
    error,
    rateLimitError,
    lastOtpSentAt,
    referralCode,
    marketingConsent,
    setOtpId,
    setVerificationToken,
    setStep,
    setIsLoading,
    setError,
    setRateLimitError,
    setLastOtpSentAt,
  } = useSignupFlowStore();

  const [resendCooldown, setResendCooldown] = useState(0);
  // Track last submitted OTP to prevent duplicate API calls
  const lastSubmittedOtpRef = useRef<string | null>(null);

  const {
    control,
    watch,
    handleSubmit,
    formState: { errors, isValid },
    reset: resetForm,
  } = useForm<OtpFormData>({
    resolver: zodResolver(otpSchema),
    mode: 'onChange',
    defaultValues: {
      otp: '',
    },
  });

  const otpValue = watch('otp');

  // Calculate and update resend cooldown
  useEffect(() => {
    if (!lastOtpSentAt) return;

    const updateCooldown = () => {
      const timeSinceLastOtp = Date.now() - lastOtpSentAt;
      const remaining = Math.max(0, Math.ceil((OTP_COOLDOWN_MS - timeSinceLastOtp) / 1000));
      setResendCooldown(remaining);
    };

    updateCooldown();
    const interval = setInterval(updateCooldown, 1000);

    return () => clearInterval(interval);
  }, [lastOtpSentAt]);

  // Redirect to email step if no email is set
  useEffect(() => {
    if (!email || !otpId) {
      router.replace(path.SIGNUP_EMAIL);
    }
  }, [email, otpId, router]);

  const onSubmit = useCallback(
    async (data: OtpFormData) => {
      setIsLoading(true);
      setError(null);

      try {
        const { verificationToken } = await verifySignupOtp(
          otpId,
          data.otp,
          email,
          referralCode || undefined,
          marketingConsent,
        );
        setVerificationToken(verificationToken);

        track(TRACKING_EVENTS.EMAIL_OTP_VERIFIED, { email, context: 'signup' });

        setStep('passkey');
        router.push(path.SIGNUP_PASSKEY);
      } catch (err: any) {
        const errorMessage = err?.message || 'Invalid verification code. Please try again.';
        setError(errorMessage);

        track(TRACKING_EVENTS.EMAIL_VERIFICATION_FAILED, {
          email,
          error: errorMessage,
          error_type: 'otp_verification_failed',
          context: 'signup',
        });
      } finally {
        setIsLoading(false);
      }
    },
    [
      otpId,
      email,
      referralCode,
      marketingConsent,
      setIsLoading,
      setError,
      setVerificationToken,
      setStep,
      router,
    ],
  );

  // Wrap onSubmit with handleSubmit for validation
  const handleVerifyOtp = handleSubmit(onSubmit);

  // Auto-submit when all digits are entered (only once per unique OTP value)
  useEffect(() => {
    if (otpValue.length === OTP_LENGTH && isValid && otpValue !== lastSubmittedOtpRef.current) {
      lastSubmittedOtpRef.current = otpValue;
      handleVerifyOtp();
    }
  }, [otpValue, isValid, handleVerifyOtp]);

  const handleResendOtp = async () => {
    if (resendCooldown > 0 || isLoading) return;

    setIsLoading(true);
    setError(null);
    setRateLimitError(null);

    try {
      const response = await initSignupOtp(email);
      setOtpId(response.otpId);
      setLastOtpSentAt(Date.now());
      resetForm({ otp: '' });
      lastSubmittedOtpRef.current = null; // Reset so user can re-enter same code for new OTP

      track(TRACKING_EVENTS.EMAIL_OTP_REQUESTED, {
        email,
        context: 'signup_resend',
      });
    } catch (err: any) {
      console.error('Failed to resend OTP:', err);
      const errorMessage = err?.message || err?.toString() || '';
      const isRateLimitError =
        errorMessage.includes('Max number of OTPs have been initiated') ||
        errorMessage.includes('please wait and try again') ||
        errorMessage.includes('Turnkey error 3');

      if (isRateLimitError) {
        setRateLimitError(
          'Too many verification codes requested. Please wait a few minutes before trying again.',
        );
      } else {
        setError('Failed to resend verification code.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleBack = () => {
    setStep('email');
    router.replace(path.SIGNUP_EMAIL);
  };

  const canResend = resendCooldown === 0 && !isLoading;
  const displayError = errors.otp?.message || error || rateLimitError;

  // Form content (shared between mobile and desktop)
  const formContent = (
    <View className="w-full max-w-[440px] items-center">
      {/* Back button - positioned above form on desktop */}
      {isDesktop && (
        <Pressable
          onPress={handleBack}
          className="self-start w-10 h-10 rounded-full bg-white/10 items-center justify-center web:hover:bg-white/20 mb-20"
        >
          <ArrowLeft size={20} color="#ffffff" />
        </Pressable>
      )}

      {/* Header */}
      <View className="mb-8 items-center">
        <Text className="text-white text-[38px] font-medium text-center mb-3 -tracking-[1px]">
          Check your email
        </Text>
        <Text className="text-white/60 text-center text-base leading-none">
          We sent a verification code to
        </Text>
        <Text className="text-white/60 text-center text-base mt-1  leading-none">{email}</Text>
      </View>

      {/* OTP Input */}
      <View className="w-full gap-5 mb-6">
        <Controller
          control={control}
          name="otp"
          render={({ field: { onChange, value } }) => (
            <OtpInput
              value={value}
              onChange={onChange}
              length={OTP_LENGTH}
              autoFocus
              error={!!displayError}
              disabled={isLoading}
            />
          )}
        />

        {displayError ? (
          <View className="flex-row items-center justify-center gap-2">
            <InfoError />
            <Text className="text-sm text-red-400">{displayError}</Text>
          </View>
        ) : null}
      </View>

      {/* Continue Button */}
      <Button
        variant="brand"
        onPress={handleVerifyOtp}
        className="rounded-xl h-14 w-full font-semibold"
      >
        {isLoading ? (
          <ActivityIndicator color="gray" />
        ) : (
          <Text className="text-lg font-semibold">Continue</Text>
        )}
      </Button>

      {/* Resend OTP */}
      <View className="flex-row items-center justify-center gap-1 mt-6">
        <Text className="text-white/60 text-base">Didn&apos;t receive it?</Text>
        {canResend ? (
          <Pressable onPress={handleResendOtp}>
            <Text className="text-white/60 text-base underline font-semibold">Resend Code</Text>
          </Pressable>
        ) : (
          <Text className="text-white/60 text-base">Resend in {resendCooldown}s</Text>
        )}
      </View>
    </View>
  );

  // Mobile Layout
  if (!isDesktop) {
    return (
      <SafeAreaView className="bg-background text-foreground flex-1">
        <View className="flex-1">
          {/* Header with back button */}
          <View className="flex-row items-center px-6 py-3">
            <Pressable
              onPress={handleBack}
              className="w-10 h-10 rounded-full bg-white/10 items-center justify-center"
            >
              <ArrowLeft size={20} color="#ffffff" />
            </Pressable>
          </View>

          {/* Content - positioned at top, centered horizontally */}
          <View className="flex-1 px-6 items-center">
            {/* Header */}
            <View className="mb-8 items-center mt-8">
              <Text className="text-white text-[38px] font-medium mb-4 text-center -tracking-[1px] leading-10">
                Check your email
              </Text>
              <Text className="text-white/60 text-[16px] text-center leading-4">
                We sent a verification code to{'\n'}
                <Text className="text-white/90 font-semibold">{email}</Text>
              </Text>
            </View>

            {/* OTP Input */}
            <View className="mb-6">
              <Controller
                control={control}
                name="otp"
                render={({ field: { onChange, value } }) => (
                  <OtpInput
                    value={value}
                    onChange={onChange}
                    length={OTP_LENGTH}
                    autoFocus
                    error={!!displayError}
                    disabled={isLoading}
                  />
                )}
              />
            </View>

            {/* Resend OTP - below OTP input */}
            <View className="flex-row items-center gap-1">
              <Text className="text-white/60">Didn&apos;t receive it?</Text>
              {canResend ? (
                <Pressable onPress={handleResendOtp}>
                  <Text className="text-white/60 font-semibold underline">Resend Code</Text>
                </Pressable>
              ) : (
                <Text className="text-white/40">Resend in {resendCooldown}s</Text>
              )}
            </View>

            {displayError ? (
              <View className="flex-row items-center gap-2 mt-4">
                <InfoError />
                <Text className="text-sm text-red-400">{displayError}</Text>
              </View>
            ) : null}
          </View>

          {/* Bottom section: Continue Button */}
          <View className="px-6 pb-8">
            <Button
              variant="brand"
              onPress={handleVerifyOtp}
              className="rounded-xl h-14 w-full font-semibold"
            >
              {isLoading ? (
                <ActivityIndicator color="gray" />
              ) : (
                <Text className="text-lg font-semibold">Continue</Text>
              )}
            </Button>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // Desktop Layout - Split Screen
  return (
    <View className="flex-1 flex-row bg-background">
      {/* Left Section - Interactive Carousel */}
      <DesktopCarousel />

      {/* Right Section - Form (70%) */}
      <View className="flex-1 relative">
        {/* Logo at top center */}
        <View className="absolute top-6 left-0 right-0 items-center">
          <Image
            source={require('@/assets/images/solid-logo-4x.png')}
            alt="Solid logo"
            style={{ width: 40, height: 44 }}
            contentFit="contain"
          />
        </View>

        {/* Form Content */}
        <View className="flex-1 justify-center items-center px-8">{formContent}</View>
      </View>
    </View>
  );
}
