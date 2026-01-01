import * as Sentry from '@sentry/react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Platform, Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';

import LoginKeyIcon from '@/assets/images/login_key_icon';
import PasskeySvg from '@/assets/images/passkey-svg';
import { DesktopCarousel } from '@/components/Onboarding';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { path } from '@/constants/path';
import { TRACKING_EVENTS } from '@/constants/tracking-events';
import { useDimension } from '@/hooks/useDimension';
import { track } from '@/lib/analytics';
import { useSignupFlowStore } from '@/store/useSignupFlowStore';
import { useTurnkey } from '@turnkey/react-native-wallet-kit';

const LEARN_MORE_URL = 'https://help.solid.xyz/passkeys';

export default function SignupPasskey() {
  const router = useRouter();
  const { isDesktop } = useDimension();
  const { email, verificationToken, _hasHydrated, setStep, setPasskeyData, setError } =
    useSignupFlowStore();
  const [isLoading, setIsLoading] = useState(false);
  const { createPasskey } = useTurnkey();

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
    setIsLoading(true);
    setError(null);

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

      track(TRACKING_EVENTS.PASSKEY_ADDED, {
        email,
        context: 'signup',
      });

      // Navigate to account creation
      setStep('creating');
      router.push(path.SIGNUP_CREATING);
    } catch (err: any) {
      console.error('Failed to create passkey:', err);

      // Handle specific WebAuthn errors
      let errorMessage = err?.message || 'Failed to create passkey. Please try again.';
      if (err?.name === 'NotAllowedError') {
        errorMessage = 'Passkey setup was cancelled. Please try again.';
      } else if (err?.name === 'TimeoutError') {
        errorMessage = 'Passkey setup timed out. Please try again.';
      }

      setError(errorMessage);

      track(TRACKING_EVENTS.SIGNUP_FAILED, {
        email,
        error: errorMessage,
        step: 'passkey',
      });

      if (Platform.OS === 'web') {
        Toast.show({
          type: 'error',
          text1: 'Passkey Setup Failed',
          text2: errorMessage,
        });
      }

      Sentry.captureException(err, {
        tags: { type: 'signup_passkey_creation_error' },
        extra: { email },
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleLearnMore = () => {
    Linking.openURL(LEARN_MORE_URL);
  };

  const handleBack = () => {
    setStep('otp');
    router.back();
  };

  // Form content (used for desktop)
  const formContent = (
    <View className="flex w-full max-w-[440px] flex-1 flex-col">
      {/* Form content wrapper - centered vertically */}
      <View className="my-auto items-center">
        {/* Back button - positioned above form on desktop */}
        {isDesktop && (
          <Pressable
            onPress={handleBack}
            className="mb-20 h-10 w-10 items-center justify-center self-start rounded-full bg-white/10 web:hover:bg-white/20"
          >
            <ArrowLeft size={20} color="#ffffff" />
          </Pressable>
        )}

        {/* Passkey Icon */}
        <PasskeySvg />

        {/* Header */}
        <View className="mb-8 mt-8 items-center">
          <Text className="mb-4 text-center text-[38px] font-semibold leading-none -tracking-[1px] text-white">
            Secure sign-in{'\n'}with Passkey
          </Text>
          <Text className="px-4 text-center text-base text-white/60">
            Passkeys let you sign in using biometrics or your device PIN—no email needed.
            They&apos;re fast, secure, and act as 2FA to protect your account.{' '}
            <Text className="text-white/60 underline" onPress={handleLearnMore}>
              Learn more
            </Text>
          </Text>
        </View>

        {/* Continue Button */}
        <Button
          variant="brand"
          onPress={handleContinue}
          className="h-14 w-full rounded-xl font-semibold"
        >
          {isLoading ? (
            <ActivityIndicator color="#000" />
          ) : (
            <View className="flex-row items-center">
              <LoginKeyIcon color="#000" />
              <Text className="ml-2 text-lg font-semibold text-black">Continue</Text>
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
            <Pressable
              onPress={handleBack}
              className="h-10 w-10 items-center justify-center rounded-full bg-white/10"
            >
              <ArrowLeft size={20} color="#ffffff" />
            </Pressable>
          </View>

          {/* Content - positioned at top, centered horizontally */}
          <View className="mt-8 items-center px-6">
            {/* Passkey Icon */}
            <PasskeySvg />

            {/* Header */}
            <View className="mt-8 items-center">
              <Text className="mb-4 text-center text-[38px] font-semibold leading-10 -tracking-[1px] text-white">
                Your account is{'\n'}protected with{'\n'}Passkey
              </Text>
              <Text className="px-4 text-center text-[16px] text-white/60">
                Passkeys let you sign in using biometrics or your device PIN—no email needed.
                They&apos;re fast, secure, and act as 2FA to protect your account.{' '}
                <Text className="font-medium text-white/60 underline" onPress={handleLearnMore}>
                  Learn more
                </Text>
              </Text>
            </View>
          </View>

          {/* Spacer to push button to bottom */}
          <View className="flex-1" />

          {/* Bottom section: Continue Button */}
          <View className="px-6 pb-8">
            <Button
              variant="brand"
              onPress={handleContinue}
              className="h-14 w-full rounded-xl font-semibold"
            >
              {isLoading ? (
                <ActivityIndicator color="#000" />
              ) : (
                <>
                  <LoginKeyIcon color="#000" />
                  <Text className="ml-2 text-lg font-semibold text-black">Continue</Text>
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
      {/* Left Section - Interactive Carousel */}
      <DesktopCarousel />

      {/* Right Section - Form (70%) */}
      <View className="relative flex-1">
        {/* Logo at top center */}
        <View className="absolute left-0 right-0 top-6 items-center">
          <Image
            source={require('@/assets/images/solid-logo-4x.png')}
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
