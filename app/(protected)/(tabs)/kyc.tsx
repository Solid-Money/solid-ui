import React, { useEffect, useRef } from 'react';
import { View } from 'react-native';
import { DiditSdk } from '@didit-protocol/sdk-web';

import { KycCompleted, KycError, KycLoading, useDiditSession } from '@/components/kyc';
import PageLayout from '@/components/PageLayout';
import { BackButton } from '@/components/ui/back-button';
import { Text } from '@/components/ui/text';

const DIDIT_EMBED_CONTAINER_ID = 'didit-verification-container';

export default function KycWeb() {
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
          hasStartedRef.current = false;
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

    // With manual review enabled the SDK never fires `didit:completed` (that
    // only fires for terminal Approved/Declined states), so `onComplete` won't
    // run for an In Review session. The user then stares at a blank Didit
    // screen. We listen to the SDK's lower-level events instead:
    //   - `verification_submitted` fires as soon as the user finishes the
    //     verification flow (including the questionnaire);
    //   - `status_updated` fires whenever Didit reports a new status. Per
    //     the Didit docs the values surfaced here are: Not Started,
    //     In Progress, Approved, Declined, In Review, Awaiting User,
    //     Resubmitted, Expired, Abandoned, Kyc Expired. ('Pending' shows up
    //     in `onComplete` only, not here.)
    DiditSdk.shared.onEvent = event => {
      if (!hasStartedRef.current) return;

      if (event.type === 'didit:verification_submitted') {
        hasStartedRef.current = false;
        onVerificationPending();
        return;
      }

      if (event.type === 'didit:status_updated') {
        const status = event.data?.status;
        switch (status) {
          case 'Approved':
            hasStartedRef.current = false;
            onVerificationComplete();
            break;
          case 'Declined':
            hasStartedRef.current = false;
            onVerificationError('Your identity verification was declined.');
            break;
          case 'Expired':
          case 'Kyc Expired':
            hasStartedRef.current = false;
            onVerificationError('Your verification session expired. Please try again.');
            break;
          case 'Abandoned':
            hasStartedRef.current = false;
            onVerificationError('Your verification was abandoned. Please try again.');
            break;
          case 'In Review':
          case 'Resubmitted':
            hasStartedRef.current = false;
            onVerificationPending();
            break;
          // 'Not Started', 'In Progress', 'Awaiting User' — keep the user in
          // the widget; they still have something to do or are mid-flow.
          default:
            break;
        }
      }
    };

    // Reset any previous SDK state so the embed container can be reused on retry
    DiditSdk.reset();
    DiditSdk.shared.startVerification({
      url: verificationUrl,
      configuration: {
        embedded: true,
        embeddedContainerId: DIDIT_EMBED_CONTAINER_ID,
        closeModalOnComplete: true,
      },
    });
    markStarted();
  }, [
    verificationUrl,
    markStarted,
    initSession,
    onVerificationComplete,
    onVerificationPending,
    onVerificationError,
  ]);

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
          <BackButton />
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
