import { zodResolver } from '@hookform/resolvers/zod';
import { Image } from 'expo-image';
import { Link, useRouter } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import { useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { z } from 'zod';

import InfoError from '@/assets/images/info-error';
import { DesktopCarousel } from '@/components/Onboarding';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import Input from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { path } from '@/constants/path';
import { TRACKING_EVENTS } from '@/constants/tracking-events';
import { useDimension } from '@/hooks/useDimension';
import { track } from '@/lib/analytics';
import { emailExists, initSignupOtp } from '@/lib/api';
import { detectAndSaveReferralCode, getReferralCodeForSignup } from '@/lib/utils/referral';
import { useSignupFlowStore } from '@/store/useSignupFlowStore';

const emailSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  marketingConsent: z.boolean(),
});

type EmailFormData = z.infer<typeof emailSchema>;

export default function SignupEmail() {
  const router = useRouter();
  const { isDesktop } = useDimension();
  const {
    email,
    marketingConsent,
    isLoading,
    error,
    rateLimitError,
    setEmail,
    setMarketingConsent,
    setOtpId,
    setReferralCode,
    setLastOtpSentAt,
    setStep,
    setIsLoading,
    setError,
    setRateLimitError,
    reset,
  } = useSignupFlowStore();

  const {
    control,
    handleSubmit,
    formState: { errors },
    watch,
  } = useForm<EmailFormData>({
    resolver: zodResolver(emailSchema),
    mode: 'onChange',
    defaultValues: {
      email: email || '',
      marketingConsent: marketingConsent || false,
    },
  });

  const watchedEmail = watch('email');

  // Detect and save referral code from URL on mount
  useEffect(() => {
    try {
      const detectedReferralCode = detectAndSaveReferralCode();
      if (detectedReferralCode) {
        console.warn('Referral code detected from URL:', detectedReferralCode);
      }
    } catch (err) {
      console.warn('Error detecting referral code:', err);
    }
  }, []);

  // Clear rate limit error when email changes
  useEffect(() => {
    if (rateLimitError && watchedEmail !== email) {
      setRateLimitError(null);
    }
  }, [watchedEmail, email, rateLimitError, setRateLimitError]);

  // Reset flow state on mount
  useEffect(() => {
    reset();
  }, [reset]);

  const handleSendOtp = async (data: EmailFormData) => {
    setIsLoading(true);
    setError(null);
    setRateLimitError(null);

    track(TRACKING_EVENTS.EMAIL_OTP_REQUESTED, {
      email: data.email,
      context: 'signup',
    });

    try {
      // Check if email already exists
      const exists = await emailExists(data.email);
      if (exists) {
        setError('This email is already registered. Please log in instead.');
        setIsLoading(false);
        return;
      }

      // Send OTP
      const response = await initSignupOtp(data.email);
      setOtpId(response.otpId);
      setEmail(data.email);
      setMarketingConsent(data.marketingConsent);
      setLastOtpSentAt(Date.now());

      // Store referral code if present
      const storedReferralCode = getReferralCodeForSignup() || '';
      if (storedReferralCode) {
        setReferralCode(storedReferralCode);
      }

      track(TRACKING_EVENTS.EMAIL_SUBMITTED, {
        email: data.email,
        context: 'signup',
      });

      setStep('otp');
      router.push(path.SIGNUP_OTP);
    } catch (err: any) {
      console.error('Failed to send OTP:', err);

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
        setError('Failed to send verification code. Please try again.');
      }

      track(TRACKING_EVENTS.EMAIL_VERIFICATION_FAILED, {
        email: data.email,
        error: errorMessage,
        error_type: 'otp_send_failed',
        context: 'signup',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleBack = () => {
    router.replace(path.ONBOARDING);
  };

  // Show validation error, API error, or rate limit error
  const displayError = errors.email?.message || error || rateLimitError;

  // Form content (shared between mobile and desktop)
  const formContent = (
    <View className="w-full max-w-[440px] flex-1 flex flex-col">
      {/* Form content wrapper - centered vertically */}
      <View className="my-auto">
        {/* Back button - positioned above form on desktop */}
        {isDesktop && (
          <Pressable
            onPress={handleBack}
            className="w-10 h-10 rounded-full bg-white/10 items-center justify-center web:hover:bg-white/20 mb-20"
          >
            <ArrowLeft size={20} color="#ffffff" />
          </Pressable>
        )}

        {/* Header */}
        <View className="mb-8">
          <Text className="text-white text-[38px] font-medium mb-4 text-center -tracking-[1px]">
            Create your account
          </Text>
          <Text className="text-white/60 text-center text-base font-medium">
            Setup in minutes. Start earning{'\n'}and spending right away
          </Text>
        </View>

        {/* Email Input */}
        <View className="gap-5 mb-6">
          <View>
            <Text className="text-white/60 text-base font-medium mb-2">Email</Text>
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
                  error={!!errors.email || !!error}
                />
              )}
            />
          </View>

          {/* Marketing consent checkbox */}
          <Controller
            control={control}
            name="marketingConsent"
            render={({ field: { onChange, value } }) => (
              <Pressable onPress={() => onChange(!value)} className="flex-row items-start gap-3">
                <Checkbox checked={value} onCheckedChange={onChange} className="mt-0.5" />
                <Text className="text-base font-medium text-white/60 flex-1">
                  I consent to receive marketing messages about Solid products and services.
                </Text>
              </Pressable>
            )}
          />

          {displayError ? (
            <View className="flex-row items-center gap-2">
              <InfoError />
              <Text className="text-sm text-red-400">{displayError}</Text>
            </View>
          ) : null}
        </View>

        {/* Create Account Button */}
        <Button
          variant="brand"
          onPress={handleSubmit(handleSendOtp)}
          className="rounded-xl h-14 w-full font-semibold"
        >
          {isLoading ? (
            <ActivityIndicator color="gray" />
          ) : (
            <Text className="text-lg font-semibold">Create account</Text>
          )}
        </Button>
      </View>

      {/* Terms and Conditions - pushed to bottom */}
      <View className="mt-auto pt-8">
        <Text className="text-sm text-white/70 text-center">
          I acknowledge that I have read and agreed to{'\n'}
          <Link href="https://solid.xyz/terms" target="_blank" className="underline text-white/70">
            Terms and Conditions
          </Link>{' '}
          and{' '}
          <Link
            href="https://solid.xyz/privacy"
            target="_blank"
            className="underline text-white/70"
          >
            Privacy Policy
          </Link>
        </Text>
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

          {/* Content - flex between to push button to bottom */}
          <View className="flex-1 px-6 pb-8 justify-between">
            {/* Top section: Form content */}
            <View className="w-full">
              {/* Header */}
              <View className="mb-8 mt-4">
                <Text className="text-white text-[38px] font-semibold text-center mb-4 -tracking-[1px] leading-10">
                  Create your{'\n'}account
                </Text>
                <Text className="text-white/60 text-center text-[16px]">
                  Setup in minutes. Start earning{'\n'}and spending right away
                </Text>
              </View>

              {/* Email Input */}
              <View className="gap-5 mb-6">
                <View>
                  <Text className="text-white/60 text-base mb-2">Email</Text>
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
                        error={!!errors.email || !!error}
                      />
                    )}
                  />
                </View>

                {/* Marketing consent checkbox */}
                <Controller
                  control={control}
                  name="marketingConsent"
                  render={({ field: { onChange, value } }) => (
                    <Pressable
                      onPress={() => onChange(!value)}
                      className="flex-row items-start gap-3"
                    >
                      <Checkbox checked={value} onCheckedChange={onChange} className="mt-0.5" />
                      <Text className="text-[16px] text-white/60 flex-1">
                        I consent to receive marketing messages about Solid products and services.
                      </Text>
                    </Pressable>
                  )}
                />

                {displayError ? (
                  <View className="flex-row items-center gap-2">
                    <InfoError />
                    <Text className="text-sm text-red-400">{displayError}</Text>
                  </View>
                ) : null}
              </View>
            </View>

            {/* Bottom section: Terms and Button */}
            <View className="w-full">
              {/* Terms and Conditions */}
              <View className="mb-8">
                <Text className="text-sm text-white/60 text-center">
                  I acknowledge that I have read and agreed to{'\n'}
                  <Link
                    href="https://solid.xyz/terms"
                    target="_blank"
                    className="underline text-white/60"
                  >
                    Terms and Conditions
                  </Link>{' '}
                  and{' '}
                  <Link
                    href="https://solid.xyz/privacy"
                    target="_blank"
                    className="underline text-white/60"
                  >
                    Privacy Policy
                  </Link>
                </Text>
              </View>

              <Button
                variant="brand"
                onPress={handleSubmit(handleSendOtp)}
                className="rounded-xl h-14 w-full font-semibold"
              >
                {isLoading ? (
                  <ActivityIndicator color="gray" />
                ) : (
                  <Text className="text-lg font-semibold">Create account</Text>
                )}
              </Button>
            </View>
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
        <View className="flex-1 items-center px-8 pt-24 pb-8">{formContent}</View>
      </View>
    </View>
  );
}
