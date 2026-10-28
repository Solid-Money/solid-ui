import { useEffect, useMemo, useRef, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { ActivityIndicator, Platform, Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import { Image } from 'expo-image';
import { Link, useRouter } from 'expo-router';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useShallow } from 'zustand/react/shallow';

import InfoError from '@/assets/images/info-error';
import { DesktopHero } from '@/components/Onboarding';
import InviteCodeField, { type InviteCodeStatus } from '@/components/Signup/InviteCodeField';
import { BackButton } from '@/components/ui/back-button';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import Input from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { path } from '@/constants/path';
import { TRACKING_EVENTS } from '@/constants/tracking-events';
import useDebounce from '@/hooks/useDebounce';
import { useDimension } from '@/hooks/useDimension';
import { useReferralInvite } from '@/hooks/useReferralInvite';
import { track } from '@/lib/analytics';
import { emailExists, initSignupOtp } from '@/lib/api';
import { getAsset } from '@/lib/assets';
import { parseInviteCodeFromText } from '@/lib/referral/inviteCode';
import { isSharedReviewAccessEmail } from '@/lib/reviewerAccess';
import { getReferralCodeForSignup } from '@/lib/utils/referral';
import { useAttributionStore } from '@/store/useAttributionStore';
import { type ReferralCodeSource, useReferralStore } from '@/store/useReferralStore';
import { useSignupFlowStore } from '@/store/useSignupFlowStore';

const emailSchema = z.object({
  email: z.email({ error: 'Please enter a valid email address' }),
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
    _hasHydrated,
    setEmail,
    setMarketingConsent,
    setOtpId,
    setReferralCode,
    setLastOtpSentAt,
    setStep,
    setIsLoading,
    setError,
    setRateLimitError,
  } = useSignupFlowStore(
    useShallow(state => ({
      email: state.email,
      marketingConsent: state.marketingConsent,
      isLoading: state.isLoading,
      error: state.error,
      rateLimitError: state.rateLimitError,
      _hasHydrated: state._hasHydrated,
      setEmail: state.setEmail,
      setMarketingConsent: state.setMarketingConsent,
      setOtpId: state.setOtpId,
      setReferralCode: state.setReferralCode,
      setLastOtpSentAt: state.setLastOtpSentAt,
      setStep: state.setStep,
      setIsLoading: state.setIsLoading,
      setError: state.setError,
      setRateLimitError: state.setRateLimitError,
    })),
  );

  const {
    control,
    handleSubmit,
    clearErrors,
    formState: { errors },
    watch,
  } = useForm<EmailFormData>({
    resolver: zodResolver(emailSchema),
    // Validate on submit only so the error appears when the button is pressed,
    // never while the user is still typing
    mode: 'onSubmit',
    reValidateMode: 'onSubmit',
    defaultValues: {
      email: email || '',
      marketingConsent: marketingConsent || false,
    },
  });

  const watchedEmail = watch('email');

  // The optional invite code: prefilled from a link, the install referrer or a
  // paste, editable, and checked against the public invite lookup as it settles.
  const [inviteText, setInviteText] = useState('');
  const [inviteSource, setInviteSource] = useState<ReferralCodeSource | null>(null);
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [canPasteInvite, setCanPasteInvite] = useState(false);
  const inviteCode = parseInviteCodeFromText(inviteText);
  const debouncedInviteCode = useDebounce(inviteCode, 400);
  const inviteLookup = useReferralInvite(debouncedInviteCode);
  const reportedInvalidCodes = useRef(new Set<string>());

  const inviteStatus = useMemo<InviteCodeStatus>(() => {
    if (!inviteCode) return { kind: 'idle' };
    if (debouncedInviteCode !== inviteCode || inviteLookup.isLoading) return { kind: 'checking' };
    if (inviteLookup.data?.valid) return { kind: 'valid', lookup: inviteLookup.data };
    if (inviteLookup.data) return { kind: 'invalid' };
    if (inviteLookup.isError) return { kind: 'unverified' };
    return { kind: 'idle' };
  }, [
    inviteCode,
    debouncedInviteCode,
    inviteLookup.isLoading,
    inviteLookup.data,
    inviteLookup.isError,
  ]);

  // Once per code — case never makes a different code: a code nobody owns is
  // worth knowing about, whichever way it came.
  useEffect(() => {
    if (inviteStatus.kind !== 'invalid' || !inviteCode) return;
    const key = inviteCode.toLowerCase();
    if (reportedInvalidCodes.current.has(key)) return;
    reportedInvalidCodes.current.add(key);
    track(TRACKING_EVENTS.INVITE_CODE_INVALID, { source: inviteSource ?? 'manual' });
  }, [inviteStatus.kind, inviteCode, inviteSource]);

  // iOS: offer the system paste control when there is text on the clipboard and
  // no code yet — the invite page copies `solid-invite:CODE` before the App
  // Store. `hasStringAsync` doesn't read the clipboard, so no paste prompt.
  useEffect(() => {
    if (!_hasHydrated || Platform.OS !== 'ios' || !Clipboard.isPasteButtonAvailable) return;
    if (inviteCode) return;
    let isActive = true;
    Clipboard.hasStringAsync()
      .then(hasString => {
        if (isActive) setCanPasteInvite(hasString);
      })
      .catch(() => {});
    return () => {
      isActive = false;
    };
  }, [_hasHydrated, inviteCode]);

  // Clear rate limit error when email changes
  useEffect(() => {
    // Wait for store hydration before any actions
    if (!_hasHydrated) return;
    if (rateLimitError && watchedEmail !== email) {
      setRateLimitError(null);
    }
  }, [_hasHydrated, watchedEmail, email, rateLimitError, setRateLimitError]);

  // Reset flow state on mount while preserving referral code
  // Attribution hook captures referral code at root - we preserve it here
  useEffect(() => {
    // Wait for store hydration before any actions
    if (!_hasHydrated) return;

    // Capture referral code BEFORE reset (from attribution or referral store)
    const existingReferral = getReferralCodeForSignup();

    // Reset the signup flow store
    useSignupFlowStore.getState().reset();

    // Restore referral code AFTER reset to prevent data loss
    if (existingReferral) {
      setReferralCode(existingReferral);
      console.warn('✅ Referral code preserved after reset:', existingReferral);
    }

    // Prefill the invite code field with it (or the attribution store's copy).
    const prefill = parseInviteCodeFromText(
      existingReferral || useAttributionStore.getState().attributionData.referral_code || '',
    );
    if (prefill) {
      setInviteText(prefill);
      setInviteSource(useReferralStore.getState().referralSource ?? 'link');
      setIsInviteOpen(true);
    }
  }, [_hasHydrated, setReferralCode]);

  // Wait for store hydration before rendering
  if (!_hasHydrated) {
    return null;
  }

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
      if (exists && !isSharedReviewAccessEmail(data.email)) {
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

      // The invite code field decides the referral code: it was prefilled from
      // the link / install referrer / attribution store, and the user may have
      // changed or cleared it. A code the lookup says nobody owns isn't sent;
      // one it couldn't check is, as typed, and the backend decides. A checked
      // one goes in the lookup's own spelling — older codes mix cases.
      const codeToSend =
        !inviteCode || inviteStatus.kind === 'invalid'
          ? ''
          : inviteStatus.kind === 'valid'
            ? inviteStatus.lookup.code
            : inviteCode;
      setReferralCode(codeToSend);
      if (codeToSend) {
        console.warn('✅ Referral code saved to signup flow:', codeToSend);
        if (inviteSource === 'manual' || inviteStatus.kind === 'valid') {
          useReferralStore.getState().setReferralCode(codeToSend, inviteSource ?? 'manual');
        }
        if (inviteSource === 'manual') {
          track(TRACKING_EVENTS.INVITE_CODE_APPLIED, { source: 'manual' });
        }
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

  // Editing the email hides any error raised by the previous submit
  const handleEmailChange = (onChange: (value: string) => void) => (text: string) => {
    onChange(text);
    if (errors.email) clearErrors('email');
    if (error) setError(null);
  };

  // Show validation error, API error, or rate limit error
  const displayError = errors.email?.message || error || rateLimitError;

  const handleInviteChange = (text: string) => {
    setInviteText(text);
    setInviteSource('manual');
  };

  const handlePasteInvite = (text: string) => {
    setCanPasteInvite(false);
    setIsInviteOpen(true);
    const code = parseInviteCodeFromText(text);
    // Whatever else was on the clipboard stays out of the field.
    if (!code) {
      track(TRACKING_EVENTS.INVITE_CODE_INVALID, { source: 'clipboard' });
      return;
    }
    setInviteText(code);
    setInviteSource('clipboard');
    useReferralStore.getState().setReferralCode(code, 'clipboard');
    track(TRACKING_EVENTS.INVITE_CODE_APPLIED, { source: 'clipboard' });
  };

  const inviteField = (
    <InviteCodeField
      value={inviteText}
      onChangeText={handleInviteChange}
      isOpen={isInviteOpen}
      onOpen={() => setIsInviteOpen(true)}
      status={inviteStatus}
      showPasteButton={canPasteInvite && !inviteCode}
      onPaste={handlePasteInvite}
    />
  );

  // Form content (shared between mobile and desktop)
  const formContent = (
    <View className="flex w-full max-w-[440px] flex-1 flex-col">
      {/* Form content wrapper - centered vertically */}
      <View className="my-auto">
        {/* Back button - positioned above form on desktop */}
        {isDesktop && (
          <View className="mb-20">
            <BackButton onPress={handleBack} />
          </View>
        )}

        {/* Header */}
        <View className="mb-8">
          <Text className="mb-4 text-center text-[34px] font-medium -tracking-[1px] text-white">
            Create your account
          </Text>
          <Text className="text-center text-base font-medium text-white/60">
            Setup in minutes. Start earning{'\n'}and spending right away
          </Text>
        </View>

        {/* Email Input */}
        <View className="mb-6 gap-5">
          <View>
            <Text className="mb-2 text-base font-medium text-white/60">Email</Text>
            <Controller
              control={control}
              name="email"
              render={({ field: { onChange, onBlur, value } }) => (
                <Input
                  id="email"
                  value={value}
                  onChangeText={handleEmailChange(onChange)}
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
                <Text className="flex-1 text-base font-medium text-white/60">
                  I consent to receive marketing messages about Solid products and services.
                </Text>
              </Pressable>
            )}
          />

          {inviteField}

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
          className="h-14 w-full rounded-xl font-semibold"
        >
          {isLoading ? (
            <ActivityIndicator color="gray" />
          ) : (
            <Text className="text-base font-bold">Create account</Text>
          )}
        </Button>
      </View>

      {/* Terms and Conditions - pushed to bottom */}
      <View className="mt-auto pt-8">
        <Text className="text-center text-sm text-white/70">
          I acknowledge that I have read and agreed to{'\n'}
          <Link
            href="https://solid.xyz/terms"
            target="_blank"
            className="text-white/70 web:underline"
          >
            Terms and Conditions
          </Link>{' '}
          and{' '}
          <Link
            href="https://solid.xyz/privacy"
            target="_blank"
            className="text-white/70 web:underline"
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
      <SafeAreaView className="flex-1 bg-background text-foreground">
        <View className="flex-1">
          {/* Header with back button */}
          <View className="flex-row items-center px-6 py-3">
            <BackButton variant="header" onPress={handleBack} />
          </View>

          {/* Content - flex between to push button to bottom */}
          <View className="flex-1 justify-between px-6 pb-8">
            {/* Top section: Form content */}
            <View className="w-full">
              {/* Header */}
              <View className="mb-8 mt-4">
                <Text className="mb-4 text-center text-[34px] font-semibold leading-[1.1] -tracking-[1px] text-white">
                  Create your{'\n'}account
                </Text>
                <Text className="text-center text-[16px] text-white/60">
                  Setup in minutes. Start earning{'\n'}and spending right away
                </Text>
              </View>

              {/* Email Input */}
              <View className="mb-6 gap-5">
                <View>
                  <Text className="mb-2 text-base text-white/60">Email</Text>
                  <Controller
                    control={control}
                    name="email"
                    render={({ field: { onChange, onBlur, value } }) => (
                      <Input
                        id="email"
                        value={value}
                        onChangeText={handleEmailChange(onChange)}
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
                      <Text className="flex-1 text-[16px] text-white/60">
                        I consent to receive marketing messages about Solid products and services.
                      </Text>
                    </Pressable>
                  )}
                />

                {inviteField}

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
                <Text className="text-center text-sm text-white/60">
                  I acknowledge that I have read and agreed to{'\n'}
                  <Link
                    href="https://solid.xyz/terms"
                    target="_blank"
                    className="text-white/60 web:underline"
                  >
                    Terms and Conditions
                  </Link>{' '}
                  and{' '}
                  <Link
                    href="https://solid.xyz/privacy"
                    target="_blank"
                    className="text-white/60 web:underline"
                  >
                    Privacy Policy
                  </Link>
                </Text>
              </View>

              <Button
                variant="brand"
                onPress={handleSubmit(handleSendOtp)}
                className="h-[50px] w-full max-w-[339px] self-center rounded-[30px] font-semibold"
              >
                {isLoading ? (
                  <ActivityIndicator color="gray" />
                ) : (
                  <Text className="text-base font-semibold">Create account</Text>
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

        {/* Form Content */}
        <View className="flex-1 items-center px-8 pb-8 pt-24">{formContent}</View>
      </View>
    </View>
  );
}
