import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useRouter } from 'expo-router';
import * as Sentry from '@sentry/react-native';
import { StamperType, useTurnkey } from '@turnkey/react-native-wallet-kit';
import { KeyRound, Lock, Mail } from 'lucide-react-native';

import Navbar from '@/components/Navbar';
import PageLayout from '@/components/PageLayout';
import { summarizeProtections } from '@/components/Security/protections';
import ProtectionsCard from '@/components/Security/ProtectionsCard';
import SecurityRow from '@/components/Security/SecurityRow';
import { BackButton } from '@/components/ui/back-button';
import { Text } from '@/components/ui/text';
import { useDimension } from '@/hooks/useDimension';
import { usePasskeyManager } from '@/hooks/usePasskeyManager';
import useUser from '@/hooks/useUser';
import { getTotpStatus } from '@/lib/api';
import { EXPO_PUBLIC_TURNKEY_ORGANIZATION_ID } from '@/lib/config';
import { lazyWithRetry } from '@/lib/lazyWithRetry';
import { cn, isPasskeyPromptError } from '@/lib/utils';
import { getThisDeviceNoun } from '@/lib/utils/passkeyDevice';
import { getPasskeyErrorDetails } from '@/lib/utils/passkeyErrors';

// Lazy load heavy modal components - only loaded when user opens them
const SecurityEmailModal = lazyWithRetry(() =>
  import('@/components/SecurityEmailModal').then(m => ({ default: m.SecurityEmailModal })),
);
const SecurityTotpModal = lazyWithRetry(() =>
  import('@/components/SecurityTotpModal').then(m => ({ default: m.SecurityTotpModal })),
);

// Minimal loading fallback for modals
const ModalLoadingFallback = () => (
  <View className="flex-1 items-center justify-center">
    <ActivityIndicator size="small" color="#94F27F" />
  </View>
);

const PASSKEY_TIMEOUT_MS = 30000;

const SectionLabel = ({ children }: { children: string }) => (
  <Text className="mb-2 mt-8 text-base text-[#8E8E8E]">{children}</Text>
);

/**
 * Settings → Security.
 *
 * Leads with how many of the three protections — passkey, recovery email,
 * 2FA — are on, and one button for the most useful one still off. Below,
 * sign-in (passkeys, authenticator app) and recovery (email).
 *
 * There is no unlock step in front of the screen any more: every change asks
 * for a passkey where it happens. Passkey changes are approved by a passkey,
 * an email change ends in one, and setting up 2FA — which talks only to our
 * backend — asks for one before the setup sheet opens.
 */
export default function Security() {
  const router = useRouter();
  const { user } = useUser();
  const { createHttpClient } = useTurnkey();
  const { isDesktop } = useDimension();
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [showTotpModal, setShowTotpModal] = useState(false);
  const [isTotpVerified, setIsTotpVerified] = useState<boolean | null>(null);
  const [isLoadingTotpStatus, setIsLoadingTotpStatus] = useState(true);
  const [isConfirmingTotp, setIsConfirmingTotp] = useState(false);
  const [totpError, setTotpError] = useState<string | null>(null);
  const {
    passkeys,
    isLoading: isLoadingPasskeys,
    isError: isPasskeysError,
    thisDeviceCredentialId,
  } = usePasskeyManager();

  // "1 passkey · this iPhone", matching how the Passkeys screen labels it.
  const passkeysSummary = isLoadingPasskeys
    ? 'Loading...'
    : passkeys.length
      ? `${passkeys.length} ${passkeys.length === 1 ? 'passkey' : 'passkeys'}${
          passkeys.length === 1 && passkeys[0].credentialId === thisDeviceCredentialId
            ? ` · ${getThisDeviceNoun()}`
            : ''
        }`
      : undefined;

  const protections = useMemo(() => {
    if (isLoadingPasskeys || isLoadingTotpStatus) return null;
    return summarizeProtections({
      // If the list could not be read, the account row still knows.
      hasPasskey: isPasskeysError ? user?.hasPasskey !== false : passkeys.length > 0,
      hasEmail: !!user?.email,
      hasTotp: isTotpVerified === true,
    });
  }, [
    isLoadingPasskeys,
    isLoadingTotpStatus,
    isPasskeysError,
    passkeys.length,
    user?.hasPasskey,
    user?.email,
    isTotpVerified,
  ]);

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

  useEffect(() => {
    fetchTotpStatus();
  }, [fetchTotpStatus]);

  /**
   * Ask for a passkey before 2FA setup opens. Setup goes to our backend on the
   * session token alone, so this is what stops someone holding an unlocked
   * phone from attaching their own authenticator to the account.
   */
  const handleSetUpTotp = useCallback(async () => {
    setIsConfirmingTotp(true);
    setTotpError(null);

    let timeout: ReturnType<typeof setTimeout> | undefined;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeout = setTimeout(
        () => reject(new Error('Passkey authentication timed out')),
        PASSKEY_TIMEOUT_MS,
      );
    });

    try {
      const passkeyClient = createHttpClient({ defaultStamperType: StamperType.Passkey });
      await Promise.race([
        passkeyClient.stampGetWhoami(
          { organizationId: EXPO_PUBLIC_TURNKEY_ORGANIZATION_ID },
          StamperType.Passkey,
        ),
        timeoutPromise,
      ]);
      setShowTotpModal(true);
    } catch (error) {
      const isTimeout = error instanceof Error && error.message.includes('timed out');
      if (isTimeout) {
        setTotpError('Your passkey took too long to answer. Try again.');
      } else if (!isPasskeyPromptError(error)) {
        setTotpError("Couldn't confirm it's you. Try again.");
        const passkeyError = getPasskeyErrorDetails(error);
        Sentry.captureException(error, {
          level: passkeyError.severity,
          fingerprint: ['{{ default }}', passkeyError.kind],
          tags: {
            type: 'security_totp_confirm_error',
            source: 'security_settings',
            passkey_error_kind: passkeyError.kind,
          },
        });
      }
      // A cancelled prompt needs no message.
    } finally {
      clearTimeout(timeout);
      setIsConfirmingTotp(false);
    }
  }, [createHttpClient]);

  const handleTotpSuccess = useCallback(() => {
    setShowTotpModal(false);
    // Refresh TOTP status after successful setup
    fetchTotpStatus();
  }, [fetchTotpStatus]);

  const handleProtectionAction = () => {
    if (protections?.action?.type === 'add-email') setShowEmailModal(true);
    else if (protections?.action?.type === 'set-up-2fa') void handleSetUpTotp();
  };

  const mobileHeader = (
    <View className="flex-row items-center justify-between px-4 py-3">
      <BackButton />
      <Text className="mr-[50px] flex-1 text-center text-xl font-bold text-white">Security</Text>
    </View>
  );

  const desktopHeader = (
    <>
      <Navbar />
      <View className="mx-auto w-full max-w-[512px] px-4 pb-8 pt-8">
        <View className="mb-8 flex-row items-center justify-between">
          <BackButton />
          <Text className="text-3xl font-semibold text-white">Security</Text>
          <View className="w-[50px]" />
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
          <ProtectionsCard
            summary={protections}
            onAction={handleProtectionAction}
            isActionBusy={isConfirmingTotp}
          />

          <View className="mt-4 flex-row items-center gap-2 px-1">
            <KeyRound size={14} color="#8E8E8E" />
            <Text className="flex-1 text-sm text-[#8E8E8E]">
              Each change asks for your passkey — no unlock step.
            </Text>
          </View>

          <SectionLabel>Sign-in</SectionLabel>
          <View className="overflow-hidden rounded-2xl bg-[#1C1C1C]">
            <SecurityRow
              icon={<KeyRound size={20} color="#FFFFFF" />}
              title="Passkeys"
              subtitle={passkeysSummary}
              onPress={() => router.push('/settings/passkeys')}
            />
            <View className="ml-[72px] h-px bg-white/10" />
            <SecurityRow
              icon={<Lock size={20} color="#FFFFFF" />}
              title="Authenticator app"
              subtitle="Two-factor authentication"
              badge={
                isLoadingTotpStatus
                  ? undefined
                  : isTotpVerified
                    ? { label: 'On', tone: 'positive' }
                    : { label: 'Off', tone: 'warning' }
              }
              isBusy={isLoadingTotpStatus || isConfirmingTotp}
              // There is nothing to manage once it is on: no way to turn it off yet.
              onPress={isTotpVerified ? undefined : handleSetUpTotp}
              accessibilityLabel="Set up two-factor authentication"
            />
          </View>
          {totpError ? <Text className="mt-2 px-1 text-sm text-red-400">{totpError}</Text> : null}

          <SectionLabel>Recovery</SectionLabel>
          <View className="overflow-hidden rounded-2xl bg-[#1C1C1C]">
            <SecurityRow
              icon={<Mail size={20} color="#FFFFFF" />}
              title="Recovery email"
              subtitle={user?.email || 'Not set'}
              badge={
                user?.email
                  ? { label: 'Verified', tone: 'positive' }
                  : { label: 'Add', tone: 'warning' }
              }
              onPress={() => setShowEmailModal(true)}
              accessibilityLabel={user?.email ? 'Change recovery email' : 'Add a recovery email'}
            />
          </View>
          <Text className="mt-2 px-1 text-sm leading-5 text-[#8E8E8E]">
            We send account alerts here and use it to help you recover your wallet if you lose your
            passkey.
          </Text>
        </View>
      </PageLayout>

      {/* Email Change Modal - Lazy loaded only when opened */}
      {showEmailModal && (
        <Suspense fallback={<ModalLoadingFallback />}>
          <SecurityEmailModal
            open={showEmailModal}
            onOpenChange={setShowEmailModal}
            onSuccess={() => setShowEmailModal(false)}
          />
        </Suspense>
      )}

      {/* TOTP Modal - Lazy loaded only when opened */}
      {showTotpModal && (
        <Suspense fallback={<ModalLoadingFallback />}>
          <SecurityTotpModal
            open={showTotpModal}
            onOpenChange={setShowTotpModal}
            onSuccess={handleTotpSuccess}
          />
        </Suspense>
      )}
    </>
  );
}
