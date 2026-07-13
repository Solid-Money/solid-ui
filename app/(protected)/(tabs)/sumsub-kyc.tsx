import React, { useEffect, useRef } from 'react';
import { View } from 'react-native';
import snsWebSdk from '@sumsub/websdk';

import {
  KycCompleted,
  KycError,
  KycLoading,
  KycUnavailable,
  useSumsubSession,
} from '@/components/kyc';
import PageLayout from '@/components/PageLayout';
import { BackButton } from '@/components/ui/back-button';
import { Text } from '@/components/ui/text';

const SUMSUB_EMBED_CONTAINER_ID = 'sumsub-websdk-container';

/**
 * Web Sumsub KYC screen (Wirex / EU flow). Embeds the Sumsub WebSDK using the
 * access token from the backend. The backend kycStatus (polled by
 * useSumsubSession) is the source of truth — it reflects the Sumsub review AND
 * the downstream Wirex hand-off — so the SDK events here are best-effort
 * accelerators only.
 */
export default function SumsubKycWeb() {
  const {
    session,
    initSession,
    markStarted,
    fetchAccessToken,
    onVerificationComplete,
    onVerificationDeclined,
    onVerificationError,
  } = useSumsubSession();
  const launchedRef = useRef(false);

  const accessToken = session.phase === 'ready' ? session.accessToken : null;

  useEffect(() => {
    if (!accessToken || launchedRef.current) return;
    launchedRef.current = true;

    // init(accessToken, expirationHandler): the handler must return a Promise
    // that resolves to a fresh token when the current one expires.
    const instance = snsWebSdk
      .init(accessToken, () => fetchAccessToken())
      .withConf({ lang: 'en' })
      .withOptions({ addViewportTag: false, adaptIframeHeight: true })
      .on('idCheck.onApplicantStatusChanged', (payload: any) => {
        // Fires when the applicant's review status changes. On a terminal
        // 'completed' status, branch on the review answer.
        if (payload?.reviewStatus === 'completed') {
          launchedRef.current = false;
          if (payload?.reviewResult?.reviewAnswer === 'RED') {
            onVerificationDeclined();
          } else {
            onVerificationComplete();
          }
        }
      })
      .on('idCheck.onError', (error: any) => {
        launchedRef.current = false;
        onVerificationError(error?.error ?? error?.message ?? 'Verification failed');
      })
      .build();

    instance.launch(`#${SUMSUB_EMBED_CONTAINER_ID}`);
    markStarted();
  }, [
    accessToken,
    fetchAccessToken,
    markStarted,
    onVerificationComplete,
    onVerificationDeclined,
    onVerificationError,
  ]);

  return (
    <PageLayout desktopOnly>
      <View className="mx-auto w-full max-w-lg flex-1 gap-8 px-4 pt-8">
        <View className="flex-row items-center justify-between">
          <BackButton />
          <Text className="text-center text-xl font-semibold text-white md:text-2xl">
            Verify identity
          </Text>
          <View style={{ width: 40 }} />
        </View>

        {session.phase === 'loading' && <KycLoading />}

        {session.phase === 'error' && <KycError message={session.message} onRetry={initSession} />}

        {session.phase === 'unavailable' && (
          <KycUnavailable message={session.message} onRetry={initSession} showBackButton={false} />
        )}

        {(session.phase === 'ready' || session.phase === 'started') && (
          <View
            id={SUMSUB_EMBED_CONTAINER_ID}
            className="mt-4 min-h-[600px] w-full"
            style={{ minHeight: 600 }}
          />
        )}

        {session.phase === 'completed' && <KycCompleted />}
      </View>
    </PageLayout>
  );
}
