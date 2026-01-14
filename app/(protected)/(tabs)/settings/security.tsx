import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import * as Sentry from '@sentry/react-native';
import { StamperType, useTurnkey } from '@turnkey/react-native-wallet-kit';
import { ArrowLeft, ChevronLeft } from 'lucide-react-native';

import Navbar from '@/components/Navbar';
import PageLayout from '@/components/PageLayout';
import { SecurityEmailModal } from '@/components/SecurityEmailModal';
import { SecurityTotpModal } from '@/components/SecurityTotpModal';
import { SettingsCard } from '@/components/Settings';
import { useDimension } from '@/hooks/useDimension';
import useUser from '@/hooks/useUser';
import { getTotpStatus } from '@/lib/api';
import { getAsset } from '@/lib/assets';
import { EXPO_PUBLIC_TURNKEY_ORGANIZATION_ID } from '@/lib/config';
import { cn } from '@/lib/utils';

const SecurityEmailIcon = getAsset('images/security_email.png');
const SecurityUnlockIcon = getAsset('images/security_unlock.png');
const SecurityKeyIcon = getAsset('images/security_key.png');
const SecurityTotpIcon = getAsset('images/security_totp.png');

export default function Security() {
  const { user } = useUser();
  const { createHttpClient } = useTurnkey();
  const { isDesktop } = useDimension();
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [isUnlocking, setIsUnlocking] = useState(false);
  const [unlockError, setUnlockError] = useState<string | null>(null);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [showTotpModal, setShowTotpModal] = useState(false);
  const [isTotpVerified, setIsTotpVerified] = useState<boolean | null>(null);
  const [isLoadingTotpStatus, setIsLoadingTotpStatus] = useState(true);

  const handleUnlock = useCallback(async () => {
    setIsUnlocking(true);
    setUnlockError(null);

    // Create a timeout promise to prevent hanging indefinitely
    const PASSKEY_TIMEOUT_MS = 30000;
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error('Passkey authentication timed out'));
      }, PASSKEY_TIMEOUT_MS);
    });

    try {
      const passkeyClient = createHttpClient({
        defaultStamperType: StamperType.Passkey,
      });

      // Race between passkey prompt and timeout
      await Promise.race([
        passkeyClient.stampGetWhoami(
          { organizationId: EXPO_PUBLIC_TURNKEY_ORGANIZATION_ID },
          StamperType.Passkey,
        ),
        timeoutPromise,
      ]);

      setIsUnlocked(true);
    } catch (error) {
      const isTimeout = error instanceof Error && error.message.includes('timed out');
      const isCancelled = error instanceof Error && error.name === 'NotAllowedError';

      if (isTimeout) {
        setUnlockError('Authentication timed out. Please try again.');
      } else if (isCancelled) {
        // User cancelled - no error message needed
        setUnlockError(null);
      } else {
        setUnlockError('Failed to unlock. Please try again.');
        Sentry.captureException(error, {
          tags: {
            type: 'security_unlock_error',
            source: 'security_settings',
          },
        });
      }
    } finally {
      setIsUnlocking(false);
    }
  }, [createHttpClient]);

  const handleChangeEmail = () => {
    setShowEmailModal(true);
  };

  const handleEmailSuccess = () => {
    setShowEmailModal(false);
  };

  const handleAddTotp = () => {
    setShowTotpModal(true);
  };

  const fetchTotpStatus = useCallback(async () => {
    setIsLoadingTotpStatus(true);
    try {
      const status = await getTotpStatus();
      setIsTotpVerified(status.verified);
    } catch (error: unknown) {
      // Check if it's a Response object with status (API throws response on error)
      const isNotFoundError = error instanceof Response && error.status === 404;

      if (isNotFoundError) {
        // 404 means TOTP is not set up yet - this is expected, not an error
        setIsTotpVerified(false);
      } else {
        // Network errors or other unexpected errors should be tracked
        Sentry.captureException(error, {
          tags: {
            type: 'totp_status_fetch_error',
            source: 'security_settings',
          },
        });
        setIsTotpVerified(false);
      }
    } finally {
      setIsLoadingTotpStatus(false);
    }
  }, []);

  const handleTotpSuccess = useCallback(() => {
    setShowTotpModal(false);
    // Refresh TOTP status after successful setup
    fetchTotpStatus();
  }, [fetchTotpStatus]);

  useEffect(() => {
    fetchTotpStatus();
  }, [fetchTotpStatus]);

  const mobileHeader = (
    <View className="flex-row items-center justify-between px-4 py-3">
      <Pressable
        onPress={() => router.back()}
        className="p-2"
        accessibilityLabel="Go back"
        accessibilityRole="button"
      >
        <ChevronLeft size={24} color="#ffffff" />
      </Pressable>
      <Text className="mr-10 flex-1 text-center text-xl font-bold text-white">Security</Text>
    </View>
  );

  const desktopHeader = (
    <>
      <Navbar />
      <View className="mx-auto w-full max-w-[512px] px-4 pb-8 pt-8">
        <View className="mb-8 flex-row items-center justify-between">
          <Pressable
            onPress={() => router.back()}
            className="web:hover:opacity-70"
            accessibilityLabel="Go back"
            accessibilityRole="button"
          >
            <ArrowLeft color="white" />
          </Pressable>
          <Text className="text-3xl font-semibold text-white">Security</Text>
          <View className="w-6" />
        </View>
      </View>
    </>
  );

  return (
    <>
      <PageLayout
        customMobileHeader={mobileHeader}
        customDesktopHeader={desktopHeader}
        useDesktopBreakpoint
      >
        <View
          className={cn('mx-auto w-full px-4 py-4 pb-32', {
            'max-w-[512px]': isDesktop,
            'max-w-7xl': !isDesktop,
          })}
        >
          {/* Unlock Banner - only show when locked */}
          {!isUnlocked && (
            <View className="mb-6 rounded-xl bg-[#94F27F]/20 p-6">
              <View className="mb-3 flex-row items-center justify-center gap-2">
                <Image source={SecurityUnlockIcon} style={{ width: 15, height: 17 }} />
                <Text className="text-base font-bold text-[#94F27F]">
                  Unlock to change settings
                </Text>
              </View>
              <Pressable
                onPress={handleUnlock}
                disabled={isUnlocking}
                className="mt-2 flex-row items-center justify-center gap-2 rounded-xl bg-[#94F27F] py-3 active:opacity-80"
                accessibilityLabel="Unlock security settings with passkey"
                accessibilityRole="button"
                accessibilityState={{ disabled: isUnlocking }}
              >
                {isUnlocking ? (
                  <ActivityIndicator color="#000000" size="small" />
                ) : (
                  <>
                    <Image source={SecurityKeyIcon} style={{ width: 23, height: 11 }} />
                    <Text className="text-base font-bold text-black">Unlock</Text>
                  </>
                )}
              </Pressable>
              {unlockError && (
                <Text className="mt-3 text-center text-sm text-red-400">{unlockError}</Text>
              )}
            </View>
          )}

          {/* Email Section */}
          <Text className="mb-2 text-base font-bold text-white">Email</Text>
          <Text className="mb-4 text-base font-medium text-[#ACACAC]">
            This email will receive important alerts regarding your account and be used for Wallet
            funds recovery.
          </Text>
          <View className="overflow-hidden rounded-xl bg-[#1c1c1c]">
            <SettingsCard
              title={user?.email || 'No email'}
              description={user?.email ? 'Verified' : undefined}
              descriptionStyle="text-[#94F27F]"
              descriptionContainerStyle="bg-[#94F27F]/15 rounded-full px-2 py-0.5 mt-1"
              icon={<Image source={SecurityEmailIcon} style={{ width: 24, height: 24 }} />}
              isDesktop={isDesktop}
              hideIconBackground
              titleStyle="font-medium"
              customAction={
                isUnlocked ? (
                  <Pressable
                    onPress={handleChangeEmail}
                    className="active:opacity-70"
                    accessibilityLabel="Change email address"
                    accessibilityRole="button"
                  >
                    <Text className="text-base font-medium text-[#ACACAC]">Change</Text>
                  </Pressable>
                ) : null
              }
            />
          </View>

          {/* Totp Section */}
          <Text className="mb-2 mt-9 text-base font-bold text-white">
            Two-factor authentication (2FA)
          </Text>
          <Text className="mb-4 text-base font-medium text-[#ACACAC]">
            Two-factor authentication adds an additional layer of security to your account.
          </Text>
          <View className="overflow-hidden rounded-xl bg-[#1c1c1c]">
            <SettingsCard
              title={
                isLoadingTotpStatus
                  ? 'Loading...'
                  : isTotpVerified
                    ? 'Authenticator app registered'
                    : 'No authenticator app registered'
              }
              description={isTotpVerified ? 'Active' : undefined}
              descriptionStyle="text-[#94F27F]"
              descriptionContainerStyle="bg-[#94F27F]/15 rounded-full px-2 py-0.5 mt-1"
              icon={<Image source={SecurityTotpIcon} style={{ width: 50, height: 50 }} />}
              isDesktop={isDesktop}
              hideIconBackground
              titleStyle="font-medium"
              customAction={
                isUnlocked ? (
                  isLoadingTotpStatus ? (
                    <ActivityIndicator color="#ACACAC" size="small" />
                  ) : (
                    !isTotpVerified && (
                      <Pressable
                        onPress={handleAddTotp}
                        className="active:opacity-70"
                        accessibilityLabel="Add two-factor authentication"
                        accessibilityRole="button"
                      >
                        <Text className="text-base font-medium text-[#ACACAC]">Add</Text>
                      </Pressable>
                    )
                  )
                ) : null
              }
            />
          </View>
        </View>
      </PageLayout>

      {/* Email Change Modal */}
      <SecurityEmailModal
        open={showEmailModal}
        onOpenChange={setShowEmailModal}
        onSuccess={handleEmailSuccess}
      />

      {/* TOTP Modal */}
      <SecurityTotpModal
        open={showTotpModal}
        onOpenChange={setShowTotpModal}
        onSuccess={handleTotpSuccess}
      />
    </>
  );
}
