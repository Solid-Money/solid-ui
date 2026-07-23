import React, { useCallback, useState } from 'react';
import { Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { ChevronRight } from 'lucide-react-native';
import { useShallow } from 'zustand/react/shallow';

import PasskeyFaqModal from '@/components/PasskeyFaqModal';
import { Text } from '@/components/ui/text';
import { path } from '@/constants/path';
import useUser from '@/hooks/useUser';
import { getAsset } from '@/lib/assets';
import { Status } from '@/lib/types';
import { useOnboardingStore } from '@/store/useOnboardingStore';
import { useUserStore } from '@/store/useUserStore';

import { LandingScreen } from './LandingScreen';
import { WelcomeSheet } from './WelcomeSheet';

/**
 * Redesigned two-step mobile onboarding. Both steps share a single full-bleed
 * hero image + dark scrim so the Welcome auth sheet (step 2) can animate in over
 * the landing hero (step 1) without the background reflowing.
 *
 * Shown only on mobile; desktop/wide-web keeps the legacy onboarding.
 * Figma: 20048-2441 (landing), 20587-4163 (welcome).
 */
export default function OnboardingNew() {
  const router = useRouter();
  const { handleLogin } = useUser();
  const setHasSeenOnboarding = useOnboardingStore(state => state.setHasSeenOnboarding);
  const { loginInfo } = useUserStore(
    useShallow(state => ({
      loginInfo: state.loginInfo,
    })),
  );

  const isLoginPending = loginInfo.status === Status.PENDING;
  const [showWelcome, setShowWelcome] = useState(false);
  const [showRecoveryLink, setShowRecoveryLink] = useState(false);
  const [showPasskeyFaq, setShowPasskeyFaq] = useState(false);

  const handleLoginPress = useCallback(async () => {
    setHasSeenOnboarding(true);
    setShowRecoveryLink(false);

    try {
      await handleLogin();
    } catch (error: any) {
      if (error?.status === 404) {
        // User not found — redirect to signup
        router.replace(path.SIGNUP_EMAIL);
      } else {
        // Other errors — show toast, stay on onboarding, and offer account recovery
        Toast.show({
          type: 'error',
          text1: 'Login failed',
          text2: error?.message || 'Something went wrong. Please try again.',
        });
        setShowRecoveryLink(true);
      }
    }
  }, [handleLogin, router, setHasSeenOnboarding]);

  const handleCreateAccount = useCallback(() => {
    setHasSeenOnboarding(true);
    router.replace(path.SIGNUP_EMAIL);
  }, [router, setHasSeenOnboarding]);

  const handleRecoverAccount = useCallback(() => {
    router.push(path.RECOVERY);
  }, [router]);

  const handleCloseWelcome = useCallback(() => {
    // Keep the sheet in place while authentication is in flight. Otherwise the
    // tap that dismisses the passkey prompt can propagate to the scrim/handle
    // and close the sheet mid-login, hiding the "Authenticating..." state.
    if (isLoginPending) return;
    setShowWelcome(false);
    setShowRecoveryLink(false);
  }, [isLoginPending]);

  // Surfaced below the Log in button after a failed login attempt so users who
  // can't authenticate (e.g. lost passkey) can read the Passkey FAQs or start
  // account recovery.
  const recoveryLink = showRecoveryLink ? (
    <View className="flex-row flex-wrap items-center justify-center">
      <Text className="text-sm text-white/60">Have trouble logging in? See our </Text>
      <Pressable onPress={() => setShowPasskeyFaq(true)} className="web:hover:opacity-70">
        <Text className="text-sm font-bold text-white">Passkey FAQs</Text>
      </Pressable>
      <Text className="text-sm text-white/60"> or </Text>
      <Pressable
        onPress={handleRecoverAccount}
        className="flex-row items-center web:hover:opacity-70"
      >
        <Text className="text-sm font-bold text-white">Recover your account</Text>
        <ChevronRight color="white" size={16} className="ml-0.5" />
      </Pressable>
    </View>
  ) : null;

  return (
    <View className="flex-1 bg-[#111]">
      {/* Shared hero background — persists across both steps */}
      <Image
        source={getAsset('images/onboarding_hero_bg.png')}
        alt=""
        style={{ position: 'absolute', width: '100%', height: '100%' }}
        contentFit="cover"
      />
      <View className="absolute inset-0 bg-black/30" />

      <SafeAreaView className="flex-1" edges={['top', 'bottom']}>
        <LandingScreen onGetStarted={() => setShowWelcome(true)} />
      </SafeAreaView>

      <WelcomeSheet
        visible={showWelcome}
        onClose={handleCloseWelcome}
        onCreateAccount={handleCreateAccount}
        onLogin={handleLoginPress}
        isLoginPending={isLoginPending}
        recoveryLink={recoveryLink}
      />

      <PasskeyFaqModal isOpen={showPasskeyFaq} onOpenChange={setShowPasskeyFaq} />
    </View>
  );
}
