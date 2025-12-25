import { Turnkey } from '@turnkey/sdk-browser';
import { router } from 'expo-router';
import { ArrowLeft, ChevronLeft } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Platform, Pressable, Text, View } from 'react-native';

import Navbar from '@/components/Navbar';
import PageLayout from '@/components/PageLayout';
import { SecurityEmailModal } from '@/components/SecurityEmailModal';
import { SecurityTotpModal } from '@/components/SecurityTotpModal';
import { SettingsCard } from '@/components/Settings';
import { getRuntimeRpId } from '@/components/TurnkeyProvider';
import { useDimension } from '@/hooks/useDimension';
import useUser from '@/hooks/useUser';
import { getTotpStatus } from '@/lib/api';
import {
  EXPO_PUBLIC_TURNKEY_API_BASE_URL,
  EXPO_PUBLIC_TURNKEY_ORGANIZATION_ID,
} from '@/lib/config';
import { base64urlToUint8Array, cn } from '@/lib/utils';

const SecurityEmailIcon = require('@/assets/images/security_email.png');
const SecurityUnlockIcon = require('@/assets/images/security_unlock.png');
const SecurityKeyIcon = require('@/assets/images/security_key.png');
const SecurityTotpIcon = require('@/assets/images/security_totp.png');

export default function Security() {
  const { user } = useUser();
  const { isDesktop } = useDimension();
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [isUnlocking, setIsUnlocking] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [showTotpModal, setShowTotpModal] = useState(false);
  const [isTotpVerified, setIsTotpVerified] = useState<boolean | null>(null);
  const [isLoadingTotpStatus, setIsLoadingTotpStatus] = useState(true);

  const handleUnlock = async () => {
    setIsUnlocking(true);
    try {
      if (Platform.OS === 'web') {
        const turnkey = new Turnkey({
          apiBaseUrl: EXPO_PUBLIC_TURNKEY_API_BASE_URL,
          defaultOrganizationId: EXPO_PUBLIC_TURNKEY_ORGANIZATION_ID,
          rpId: getRuntimeRpId(),
        });

        // Prepare allowCredentials if we have a credential ID for this user
        const allowCredentials = user?.credentialId
          ? [
              {
                id: base64urlToUint8Array(user.credentialId) as BufferSource,
                type: 'public-key' as const,
              },
            ]
          : undefined;

        const passkeyClient = turnkey.passkeyClient(
          allowCredentials ? { allowCredentials } : undefined,
        );

        // This will trigger the passkey prompt
        await passkeyClient.stampGetWhoami({
          organizationId: EXPO_PUBLIC_TURNKEY_ORGANIZATION_ID,
        });

        setIsUnlocked(true);
      } else {
        // For native, we would use the native passkey API
        // For now, just unlock
        setIsUnlocked(true);
      }
    } catch (error) {
      console.error('Failed to unlock:', error);
    } finally {
      setIsUnlocking(false);
    }
  };

  const handleChangeEmail = () => {
    setShowEmailModal(true);
  };

  const handleEmailSuccess = () => {
    setShowEmailModal(false);
  };

  const handleAddTotp = () => {
    setShowTotpModal(true);
  };

  const handleTotpSuccess = () => {
    setShowTotpModal(false);
    // Refresh TOTP status after successful setup
    fetchTotpStatus();
  };

  const fetchTotpStatus = async () => {
    setIsLoadingTotpStatus(true);
    try {
      const status = await getTotpStatus();
      setIsTotpVerified(status.verified);
    } catch (error) {
      console.error('Failed to fetch TOTP status:', error);
      // If TOTP is not set up, API might return 404, which is fine
      setIsTotpVerified(false);
    } finally {
      setIsLoadingTotpStatus(false);
    }
  };

  useEffect(() => {
    fetchTotpStatus();
  }, []);

  const mobileHeader = (
    <View className="flex-row items-center justify-between px-4 py-3">
      <Pressable onPress={() => router.back()} className="p-2">
        <ChevronLeft size={24} color="#ffffff" />
      </Pressable>
      <Text className="text-white text-xl font-bold flex-1 text-center mr-10">Security</Text>
    </View>
  );

  const desktopHeader = (
    <>
      <Navbar />
      <View className="max-w-[512px] mx-auto w-full px-4 pt-8 pb-8">
        <View className="flex-row items-center justify-between mb-8">
          <Pressable onPress={() => router.back()} className="web:hover:opacity-70">
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
        scrollable={false}
      >
        <View
          className={cn('w-full mx-auto px-4 py-4 flex-1', {
            'max-w-[512px]': isDesktop,
            'max-w-7xl': !isDesktop,
          })}
        >
          {/* Unlock Banner - only show when locked */}
          {!isUnlocked && (
            <View className="bg-[#94F27F]/20 rounded-xl p-6 mb-6">
              <View className="flex-row items-center justify-center gap-2 mb-3">
                <Image source={SecurityUnlockIcon} style={{ width: 15, height: 17 }} />
                <Text className="text-[#94F27F] text-base font-bold">
                  Unlock to change settings
                </Text>
              </View>
              <Pressable
                onPress={handleUnlock}
                disabled={isUnlocking}
                className="bg-[#94F27F] rounded-xl mt-2 py-3 flex-row items-center justify-center gap-2 active:opacity-80"
              >
                {isUnlocking ? (
                  <ActivityIndicator color="#000000" size="small" />
                ) : (
                  <>
                    <Image source={SecurityKeyIcon} style={{ width: 23, height: 11 }} />
                    <Text className="text-black text-base font-bold">Unlock</Text>
                  </>
                )}
              </Pressable>
            </View>
          )}

          {/* Email Section */}
          <Text className="text-white text-base font-bold mb-2">Email</Text>
          <Text className="text-[#ACACAC] text-base font-medium mb-4">
            This email will receive important alerts regarding your account and be used for Wallet
            funds recovery.
          </Text>
          <View className="bg-[#1c1c1c] rounded-xl overflow-hidden">
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
                  <Pressable onPress={handleChangeEmail} className="active:opacity-70">
                    <Text className="text-[#ACACAC] text-base">Change</Text>
                  </Pressable>
                ) : null
              }
            />
          </View>

          {/* Totp Section */}
          <Text className="text-white text-base font-bold mt-9 mb-2">
            Two-factor authentication (2FA)
          </Text>
          <Text className="text-[#ACACAC] text-base font-medium mb-4">
            Two-factor authentication adds an additional layer of security to your account.
          </Text>
          <View className="bg-[#1c1c1c] rounded-xl overflow-hidden">
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
                      <Pressable onPress={handleAddTotp} className="active:opacity-70">
                        <Text className="text-[#ACACAC] text-base">Add</Text>
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
