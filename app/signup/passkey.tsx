import * as Sentry from '@sentry/react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Platform, Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import { v4 as uuidv4 } from 'uuid';

import LoginKeyIcon from '@/assets/images/login_key_icon';
import PasskeySvg from '@/assets/images/passkey-svg';
import { DesktopCarousel } from '@/components/Onboarding';
import { getRuntimeRpId } from '@/components/TurnkeyProvider';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { path } from '@/constants/path';
import { TRACKING_EVENTS } from '@/constants/tracking-events';
import { useDimension } from '@/hooks/useDimension';
import { track } from '@/lib/analytics';
import {
  EXPO_PUBLIC_TURNKEY_API_BASE_URL,
  EXPO_PUBLIC_TURNKEY_ORGANIZATION_ID,
} from '@/lib/config';
import { useSignupFlowStore } from '@/store/useSignupFlowStore';

const LEARN_MORE_URL = 'https://help.solid.xyz/passkeys';

export default function SignupPasskey() {
  const router = useRouter();
  const { isDesktop } = useDimension();
  const { email, verificationToken, setStep, setPasskeyData, setError } = useSignupFlowStore();
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // Redirect if no verification token (user hasn't completed OTP)
    if (!verificationToken || !email) {
      router.replace(path.SIGNUP_EMAIL);
    }
  }, []);

  const handleContinue = async () => {
    setIsLoading(true);
    setError(null);

    try {
      let challenge: string;
      let attestation: any;
      let credentialId: string;

      if (Platform.OS === 'web') {
        // Web: Use Turnkey browser SDK
        const { Turnkey } = await import('@turnkey/sdk-browser');
        const turnkey = new Turnkey({
          apiBaseUrl: EXPO_PUBLIC_TURNKEY_API_BASE_URL,
          defaultOrganizationId: EXPO_PUBLIC_TURNKEY_ORGANIZATION_ID,
          rpId: getRuntimeRpId(),
        });

        const passkeyClient = turnkey.passkeyClient();
        const passkey = await passkeyClient.createUserPasskey({
          publicKey: {
            user: {
              name: email,
              displayName: email,
            },
            timeout: 120000,
          },
        });

        challenge = passkey.encodedChallenge;
        attestation = passkey.attestation;
        credentialId = passkey.attestation.credentialId;
      } else {
        // Native: Use React Native passkey stamper
        const { createPasskey } = await import('@turnkey/react-native-passkey-stamper');
        const passkey = await createPasskey({
          authenticatorName: 'End-User Passkey',
          rp: {
            id: getRuntimeRpId(),
            name: 'Solid',
          },
          user: {
            id: uuidv4(),
            name: email,
            displayName: email,
          },
        });

        challenge = passkey.challenge;
        attestation = passkey.attestation;
        credentialId = passkey.attestation.credentialId;
      }

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
    <View className="w-full max-w-[400px] items-center">
      {/* Passkey Icon */}
      <PasskeySvg />

      {/* Header */}
      <View className="mt-8 mb-8 items-center">
        <Text className="text-white text-[32px] font-medium text-center mb-4">
          Your account is{'\n'}protected with{'\n'}Passkey
        </Text>
        <Text className="text-white/60 text-center text-[14px] px-4">
          Passkeys let you sign in using biometrics or your device PIN—no email needed. They're
          fast, secure, and act as 2FA to protect your account.{' '}
          <Text className="text-white underline" onPress={handleLearnMore}>
            Learn more
          </Text>
        </Text>
      </View>

      {/* Continue Button */}
      <Button
        variant="brand"
        onPress={handleContinue}
        disabled={isLoading}
        className="rounded-xl h-14 w-full"
      >
        {isLoading ? (
          <ActivityIndicator color="#000" />
        ) : (
          <>
            <LoginKeyIcon color="#000" />
            <Text className="text-lg font-semibold text-black ml-2">Continue</Text>
          </>
        )}
      </Button>
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
          <View className="px-6 items-center mt-8">
            {/* Passkey Icon */}
            <PasskeySvg />

            {/* Header */}
            <View className="mt-8 items-center">
              <Text className="text-white text-[38px] font-semibold text-center mb-4">
                Your account is{'\n'}protected with{'\n'}Passkey
              </Text>
              <Text className="text-white/60 text-center text-[14px] px-4">
                Passkeys let you sign in using biometrics or your device PIN—no email needed.
                They're fast, secure, and act as 2FA to protect your account.{' '}
                <Text className="text-white/60 underline" onPress={handleLearnMore}>
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
              disabled={isLoading}
              className="rounded-xl h-14 w-full"
            >
              {isLoading ? (
                <ActivityIndicator color="#000" />
              ) : (
                <>
                  <LoginKeyIcon color="#000" />
                  <Text className="text-lg font-semibold text-black ml-2">Continue</Text>
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
