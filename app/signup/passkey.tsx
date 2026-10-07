import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Linking, Platform, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import * as Sentry from '@sentry/react-native';
import { useTurnkey } from '@turnkey/react-native-wallet-kit';
import { useShallow } from 'zustand/react/shallow';

import InfoError from '@/assets/images/info-error';
import LoginKeyIcon from '@/assets/images/login_key_icon';
import { DesktopHero } from '@/components/Onboarding';
import { AnimatedPasskeyIcon } from '@/components/Onboarding/AnimatedPasskeyIcon';
import {
  passkeyFailureMessage,
  PasskeyHelp,
  shouldShowPasskeyHelp,
} from '@/components/Onboarding/PasskeyHelp';
import { BackButton } from '@/components/ui/back-button';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { Underline } from '@/components/ui/underline';
import { path } from '@/constants/path';
import { TRACKING_EVENTS } from '@/constants/tracking-events';
import { useDimension } from '@/hooks/useDimension';
import { track } from '@/lib/analytics';
import { getAsset } from '@/lib/assets';
import { getPasskeyErrorDetails, PasskeyFailureKind } from '@/lib/utils/passkeyErrors';
import {
  buildOpenInBrowserUrl,
  DevicePlatform,
  getDevicePlatform,
  getInAppBrowserName,
  isLikelyInAppBrowser,
  readBrowserEnvironment,
} from '@/lib/utils/passkeySupport';
import { redactSecrets } from '@/lib/utils/userFacingError';
import { useSignupFlowStore } from '@/store/useSignupFlowStore';

const LEARN_MORE_URL = 'https://help.solid.xyz/passkeys';

/** The kinds a person chose, or may have chosen. */
const USER_DRIVEN_FAILURES: PasskeyFailureKind[] = ['cancelled', 'not_allowed'];

type PasskeyFailure = { kind: PasskeyFailureKind; count: number };

export default function SignupPasskey() {
  const router = useRouter();
  const { isDesktop } = useDimension();
  const {
    email,
    verificationToken,
    referralCode,
    _hasHydrated,
    setStep,
    setPasskeyData,
    setError,
  } = useSignupFlowStore(
    useShallow(state => ({
      email: state.email,
      verificationToken: state.verificationToken,
      referralCode: state.referralCode,
      _hasHydrated: state._hasHydrated,
      setStep: state.setStep,
      setPasskeyData: state.setPasskeyData,
      setError: state.setError,
    })),
  );
  const [isLoading, setIsLoading] = useState(false);
  const [failure, setFailure] = useState<PasskeyFailure | null>(null);
  const attemptRef = useRef(0);
  const { createPasskey } = useTurnkey();

  // What the browser says about itself, for the help shown after a failure.
  const browser = useMemo(() => {
    const environment = Platform.OS === 'web' ? readBrowserEnvironment() : null;
    const platform: DevicePlatform = environment
      ? getDevicePlatform(environment.userAgent, environment.hasTouch)
      : Platform.OS === 'ios'
        ? 'ios'
        : Platform.OS === 'android'
          ? 'android'
          : 'other';
    return {
      platform,
      app: environment ? getInAppBrowserName(environment.userAgent) : null,
      inAppBrowser: environment ? isLikelyInAppBrowser(environment) : false,
    };
  }, []);

  const openInBrowserUrl = useMemo(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return undefined;
    // Back to the start of signup, carrying the referral code so the
    // referrer is still credited from the other browser.
    const from = referralCode ? `/?ref=${encodeURIComponent(referralCode)}` : '/';
    return buildOpenInBrowserUrl(window.location.origin, from);
  }, [referralCode]);

  const showHelp = failure ? shouldShowPasskeyHelp(failure.kind, failure.count) : false;

  // Once per failure that shows the tips: `failure` is a new object each time.
  useEffect(() => {
    if (!showHelp || !failure) return;
    track(TRACKING_EVENTS.PASSKEY_HELP_VIEWED, {
      email,
      error_kind: failure.kind,
      failure_count: failure.count,
      in_app_browser: browser.app ?? (browser.inAppBrowser ? 'unknown' : undefined),
    });
  }, [showHelp, failure, email, browser]);

  useEffect(() => {
    // Wait for store hydration before redirect decisions
    if (!_hasHydrated) return;
    // Redirect if no verification token (user hasn't completed OTP)
    if (!verificationToken || !email) {
      router.replace(path.SIGNUP_EMAIL);
    }
  }, [_hasHydrated, verificationToken, email, router]);

  // Wait for store hydration before rendering
  if (!_hasHydrated) {
    return null;
  }

  const handleContinue = async () => {
    // A second tap would start a second request while the first is still
    // pending, and that one fails on its own ("A request is already pending").
    if (isLoading) return;
    setIsLoading(true);
    setError(null);
    attemptRef.current += 1;
    const startedAt = Date.now();

    try {
      // Use the unified createPasskey from the new SDK
      // This works on both web and native platforms automatically
      // Sanitize email for passkey name using same logic as backend generateUniqueUsername
      const passkeyName = email
        .toLowerCase()
        .replace(/[^a-z0-9._-]/g, '')
        .substring(0, 64);
      const passkey = await createPasskey({
        name: passkeyName,
      });

      const { encodedChallenge: challenge, attestation } = passkey;
      const credentialId = attestation.credentialId;

      // Store passkey data in the signup flow store
      setPasskeyData({ challenge, attestation, credentialId });
      setFailure(null);

      track(TRACKING_EVENTS.PASSKEY_ADDED, {
        email,
        context: 'signup',
        attempt: attemptRef.current,
      });

      // Navigate to account creation
      setStep('creating');
      router.push(path.SIGNUP_CREATING);
    } catch (err: any) {
      console.error('Failed to create passkey:', err);

      // Turnkey wraps the real failure: its own `name` is always
      // `TurnkeyError` and its message rarely says more than "Failed to
      // create passkey". The reason is at the bottom of `err.cause`.
      const elapsedMs = Date.now() - startedAt;
      const details = getPasskeyErrorDetails(err, { elapsedMs });
      const message = passkeyFailureMessage(details.kind, Platform.OS === 'web');

      setError(message);
      setFailure(previous => ({ kind: details.kind, count: (previous?.count ?? 0) + 1 }));

      track(TRACKING_EVENTS.SIGNUP_FAILED, {
        email,
        error: redactSecrets(err?.message || message),
        step: 'passkey',
        error_kind: details.kind,
        error_code: details.code,
        error_cause_name: details.causeName,
        error_cause_message: details.causeMessage && redactSecrets(details.causeMessage),
        // A dismissed prompt, or a NotAllowedError that WebAuthn will not
        // tell apart from one: not a failure of the app.
        is_cancelled: USER_DRIVEN_FAILURES.includes(details.kind),
        elapsed_ms: elapsedMs,
        attempt: attemptRef.current,
        in_app_browser: browser.app ?? (browser.inAppBrowser ? 'unknown' : undefined),
      });

      // At the kind's level (a dismissed prompt is `info`), and grouped by it:
      // Sentry otherwise files cancels and real failures under one issue.
      Sentry.captureException(err, {
        level: details.severity,
        fingerprint: ['{{ default }}', details.kind],
        tags: {
          type: 'signup_passkey_creation_error',
          passkey_error_kind: details.kind,
          passkey_error_cause: details.causeName ?? 'none',
        },
        extra: {
          email,
          code: details.code,
          causeMessage: details.causeMessage,
          elapsedMs,
          attempt: attemptRef.current,
        },
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleLearnMore = () => {
    Linking.openURL(LEARN_MORE_URL);
  };

  const handleBack = () => {
    setStep('username');
    router.back();
  };

  const failureContent = failure ? (
    <View className="w-full gap-4">
      <View className="flex-row items-center gap-2">
        <InfoError />
        <Text className="flex-1 text-sm text-red-400">
          {passkeyFailureMessage(failure.kind, Platform.OS === 'web')}
        </Text>
      </View>
      {showHelp ? (
        <PasskeyHelp
          kind={failure.kind}
          platform={browser.platform}
          inAppBrowser={browser.inAppBrowser}
          openInBrowserUrl={openInBrowserUrl}
        />
      ) : null}
    </View>
  ) : null;

  // Form content (used for desktop)
  const formContent = (
    <View className="flex w-full max-w-[440px] flex-1 flex-col">
      {/* Form content wrapper - centered vertically */}
      <View className="my-auto items-center">
        {/* Back button - positioned above form on desktop */}
        {isDesktop && (
          <View className="mb-20 self-start">
            <BackButton onPress={handleBack} />
          </View>
        )}

        {/* Passkey Icon */}
        <AnimatedPasskeyIcon />

        {/* Header */}
        <View className="mb-8 mt-8 items-center">
          <Text className="mb-4 text-center text-[34px] font-semibold leading-none -tracking-[1px] text-white">
            Protect your account{'\n'}with a passkey
          </Text>
          <View className="px-4">
            <Text className="text-center text-base font-normal leading-[19px] text-white/60">
              Sign in with Face ID, fingerprint, or your device PIN. No passwords, no codes.
              Passkeys are phishing-resistant and act as built-in 2FA.{' '}
              <Text
                accessibilityRole="link"
                className="font-bold text-white/60 underline"
                onPress={handleLearnMore}
              >
                Learn more
              </Text>
            </Text>
          </View>
        </View>

        {failureContent ? <View className="mb-6 w-full">{failureContent}</View> : null}

        {/* Continue Button */}
        <Button
          variant="brand"
          onPress={handleContinue}
          disabled={isLoading}
          className="h-14 w-full rounded-xl font-semibold"
        >
          {isLoading ? (
            <ActivityIndicator color="#000" />
          ) : (
            <View className="flex-row items-center">
              <LoginKeyIcon color="#000" />
              <Text className="ml-2 text-base font-semibold text-black">Continue</Text>
            </View>
          )}
        </Button>
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

          {/* Scrolls once the setup tips make the content taller than the screen */}
          <ScrollView className="flex-1" contentContainerClassName="flex-grow">
            {/* Content - positioned at top, centered horizontally */}
            <View className="mt-2 items-center px-6">
              {/* Passkey Icon */}
              <AnimatedPasskeyIcon />

              {/* Header */}
              <View className="mt-7 items-center">
                <Text className="w-[330px] text-center text-[30px] font-medium leading-[32px] -tracking-[1px] text-white">
                  Protect your account{'\n'}with a passkey
                </Text>
                <View className="mt-[15px] w-[330px] items-center">
                  <Text className="text-center text-[16px] font-normal leading-[19px] text-white/60">
                    Sign in with Face ID, fingerprint, or your{'\n'}
                    device PIN. No passwords, no codes.{'\n'}
                    Passkeys are phishing-resistant and act as
                  </Text>
                  <View className="flex-row items-baseline justify-center">
                    <Text className="text-[16px] font-normal leading-[19px] text-white/60">
                      built-in 2FA.{' '}
                    </Text>
                    <Underline
                      onPress={handleLearnMore}
                      textClassName="text-[16px] font-bold leading-[19px] text-white/60"
                      borderColor="rgba(255, 255, 255, 0.6)"
                      borderWidth={0.5}
                    >
                      Learn more
                    </Underline>
                  </View>
                </View>
              </View>

              {failureContent ? (
                <View className="mt-6 w-full max-w-[339px]">{failureContent}</View>
              ) : null}
            </View>
          </ScrollView>

          {/* Bottom section: Continue Button */}
          <View className="px-[18px] pb-0 pt-3">
            <Button
              variant="brand"
              onPress={handleContinue}
              disabled={isLoading}
              className="w-full max-w-[339px] self-center"
            >
              {isLoading ? (
                <ActivityIndicator color="#000" />
              ) : (
                <>
                  <LoginKeyIcon color="#000" />
                  <Text className="ml-2 text-base font-semibold text-black">Continue</Text>
                </>
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
        <View className="flex-1 items-center justify-center px-8">{formContent}</View>
      </View>
    </View>
  );
}
