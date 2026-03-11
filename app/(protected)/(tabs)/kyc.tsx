import React, { useEffect, useRef } from 'react';
import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { DiditSdk } from '@didit-protocol/sdk-web';
import { ArrowLeft } from 'lucide-react-native';

import { KycCompleted, KycError, KycLoading, useDiditSession } from '@/components/kyc';
import PageLayout from '@/components/PageLayout';
import { Text } from '@/components/ui/text';

const DIDIT_EMBED_CONTAINER_ID = 'didit-verification-container';

export default function KycWeb() {
  const router = useRouter();
  const {
    session,
    initSession,
    markStarted,
    onVerificationComplete,
    onVerificationPending,
    onVerificationError,
  } = useDiditSession();
  const hasStartedRef = useRef(false);

  const verificationUrl = session.phase === 'ready' ? session.verificationUrl : null;

  useEffect(() => {
    if (!verificationUrl || hasStartedRef.current) return;

    hasStartedRef.current = true;

    DiditSdk.shared.onComplete = result => {
      switch (result.type) {
        case 'completed':
          if (result.session?.status === 'Approved') {
            onVerificationComplete();
          } else if (result.session?.status === 'Declined') {
            onVerificationError('Your identity verification was declined.');
          } else {
            // 'Pending', 'In Review', etc. — redirect back to activate page
            // so user sees "Under Review" state instead of blank page
            onVerificationPending();
          }
          break;
        case 'cancelled':
          hasStartedRef.current = false;
          initSession();
          break;
        case 'failed':
          hasStartedRef.current = false;
          onVerificationError(result.error?.message ?? 'Verification failed');
          break;
      }
    };

    DiditSdk.shared.startVerification({
      url: verificationUrl,
      configuration: {
        embedded: true,
        embeddedContainerId: DIDIT_EMBED_CONTAINER_ID,
        closeModalOnComplete: true,
      },
    });
    markStarted();
  }, [verificationUrl, markStarted, initSession, onVerificationComplete, onVerificationPending, onVerificationError]);

  // Clean up SDK on unmount only. This is separate from the init effect above
  // because markStarted() changes the phase to 'started', which nullifies
  // verificationUrl and would otherwise trigger the cleanup immediately,
  // destroying the widget right after it appears.
  useEffect(() => {
    return () => {
      DiditSdk.reset();
    };
  }, []);

  return (
    <PageLayout desktopOnly>
      <View className="mx-auto w-full max-w-lg flex-1 gap-8 px-4 pt-8">
        <View className="flex-row items-center justify-between">
          <Pressable
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
            className="flex h-10 w-10 items-center justify-center rounded-full border-0 bg-popover web:transition-colors web:hover:bg-muted"
          >
            <ArrowLeft size={24} color="#FFFFFF" />
          </Pressable>
          <Text className="text-center text-xl font-semibold text-white md:text-2xl">
            Verify identity
          </Text>
          <View style={{ width: 40 }} />
        </View>

        {session.phase === 'loading' && <KycLoading />}

        {session.phase === 'error' && <KycError message={session.message} onRetry={initSession} />}

        {(session.phase === 'ready' || session.phase === 'started') && (
          <View
            id={DIDIT_EMBED_CONTAINER_ID}
            className="mt-4 min-h-[600px] w-full"
            style={{ minHeight: 600 }}
          />
        )}

        {session.phase === 'completed' && <KycCompleted />}
      </View>
    </PageLayout>
  );
}
