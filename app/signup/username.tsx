import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useShallow } from 'zustand/react/shallow';

import InfoError from '@/assets/images/info-error';
import { DesktopHero } from '@/components/Onboarding';
import { BackButton } from '@/components/ui/back-button';
import { Button } from '@/components/ui/button';
import Input from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { path } from '@/constants/path';
import { TRACKING_EVENTS } from '@/constants/tracking-events';
import { useDimension } from '@/hooks/useDimension';
import { USERNAME_TAKEN_FALLBACK, useUsernameAvailability } from '@/hooks/useUsernameAvailability';
import { track } from '@/lib/analytics';
import { checkUsernameAvailability } from '@/lib/api';
import { getAsset } from '@/lib/assets';
import { isSharedReviewAccessEmail } from '@/lib/reviewerAccess';
import {
  getUsernameFormatError,
  normalizeUsername,
  sanitizeUsernameInput,
  suggestUsernameFromEmail,
  USERNAME_MAX_LENGTH,
} from '@/lib/utils/username';
import { useSignupFlowStore } from '@/store/useSignupFlowStore';

export default function SignupUsername() {
  const router = useRouter();
  const { isDesktop } = useDimension();
  const { email, storedUsername, verificationToken, _hasHydrated, setUsername, setStep, setError } =
    useSignupFlowStore(
      useShallow(state => ({
        email: state.email,
        storedUsername: state.username,
        verificationToken: state.verificationToken,
        _hasHydrated: state._hasHydrated,
        setUsername: state.setUsername,
        setStep: state.setStep,
        setError: state.setError,
      })),
    );

  const [value, setValue] = useState('');
  const availability = useUsernameAvailability(value);
  // The format error is only shown once the user has tried to continue, so a
  // half-typed name is not called invalid while they are still typing it.
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const hasSeededRef = useRef(false);

  const isSharedReviewAccess = isSharedReviewAccessEmail(email);

  // Redirect if the earlier steps have not been completed. The shared review
  // account already exists and keeps its own handle, so it skips this step the
  // same way it skips the passkey one.
  useEffect(() => {
    if (!_hasHydrated) return;
    if (!verificationToken || !email) {
      router.replace(path.SIGNUP_EMAIL);
      return;
    }
    if (isSharedReviewAccess) {
      router.replace(path.SIGNUP_CREATING);
    }
  }, [_hasHydrated, verificationToken, email, isSharedReviewAccess, router]);

  // Seed once from a previously chosen handle (resuming the flow), otherwise
  // from the email address — the name the account would have been given
  // automatically before this step existed.
  useEffect(() => {
    if (!_hasHydrated || hasSeededRef.current) return;
    hasSeededRef.current = true;
    setValue(storedUsername || suggestUsernameFromEmail(email));
  }, [_hasHydrated, storedUsername, email]);

  useEffect(() => {
    if (!_hasHydrated) return;
    track(TRACKING_EVENTS.USERNAME_STEP_VIEWED, { email });
  }, [_hasHydrated, email]);

  const handleChange = (text: string) => {
    setValue(sanitizeUsernameInput(text));
    setSubmitError(null);
  };

  const handleContinue = useCallback(async () => {
    if (isSubmitting) return;

    const formatError = getUsernameFormatError(value);
    if (formatError) {
      setSubmitError(formatError);
      return;
    }

    const candidate = normalizeUsername(value);
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      // Re-checked on submit rather than trusting the debounced result, which
      // may be stale or may never have run on a slow connection.
      const result = await checkUsernameAvailability(candidate);
      if (!result.available) {
        const reason = result.reason || USERNAME_TAKEN_FALLBACK;
        setSubmitError(reason);
        track(TRACKING_EVENTS.USERNAME_UNAVAILABLE, { email, reason });
        return;
      }
    } catch {
      // Unreachable check: carry on and let account creation decide, rather
      // than stranding the user on this step.
    } finally {
      setIsSubmitting(false);
    }

    setUsername(candidate);
    setError(null);
    track(TRACKING_EVENTS.USERNAME_SUBMITTED, { email });

    setStep('passkey');
    router.push(path.SIGNUP_PASSKEY);
  }, [isSubmitting, value, email, setUsername, setError, setStep, router]);

  const handleBack = () => {
    setStep('otp');
    router.replace(path.SIGNUP_OTP);
  };

  if (!_hasHydrated) {
    return null;
  }

  const isAvailable = availability.status === 'available';
  const displayError =
    submitError || (availability.status === 'unavailable' ? availability.reason : null);
  const canContinue = !getUsernameFormatError(value) && !isSubmitting && !displayError;

  const usernameField = (
    <View>
      <Text className="mb-2 text-base text-white/60">Username</Text>
      <Input
        id="username"
        value={value}
        onChangeText={handleChange}
        onSubmitEditing={handleContinue}
        placeholder="Your username"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="username-new"
        returnKeyType="done"
        maxLength={USERNAME_MAX_LENGTH}
        className="rounded-full bg-[#2F2F2F]"
        error={!!displayError}
        prefix={<Text className="text-lg font-semibold text-white/40">@</Text>}
      />

      {/* One status line: the problem to fix, or confirmation the name is free */}
      {displayError ? (
        <View className="mt-3 flex-row items-center gap-2">
          <InfoError />
          <Text className="flex-1 text-sm text-red-400">{displayError}</Text>
        </View>
      ) : availability.status === 'checking' ? (
        <Text className="mt-3 text-sm text-white/40">Checking availability…</Text>
      ) : isAvailable ? (
        <Text className="mt-3 text-sm text-brand">@{normalizeUsername(value)} is available</Text>
      ) : null}
    </View>
  );

  const continueButton = (className: string) => (
    <Button variant="brand" onPress={handleContinue} disabled={!canContinue} className={className}>
      {isSubmitting ? (
        <ActivityIndicator color="gray" />
      ) : (
        <Text className="text-base font-bold">Continue</Text>
      )}
    </Button>
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
            <View className="w-full">
              <View className="mb-8 mt-4">
                <Text className="text-center text-[34px] font-semibold leading-[1.1] -tracking-[1px] text-white">
                  Choose a username
                </Text>
              </View>

              {usernameField}
            </View>

            {continueButton(
              'h-[50px] w-full max-w-[339px] self-center rounded-[30px] font-semibold',
            )}
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

      {/* Right Section - Form */}
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

        <View className="flex-1 items-center justify-center px-8">
          <View className="w-full max-w-[440px]">
            <View className="mb-20">
              <BackButton onPress={handleBack} />
            </View>

            <View className="mb-8">
              <Text className="text-center text-[34px] font-semibold -tracking-[1px] text-white">
                Choose a username
              </Text>
            </View>

            <View className="mb-6">{usernameField}</View>

            {continueButton('h-14 w-full rounded-xl font-semibold')}
          </View>
        </View>
      </View>
    </View>
  );
}
