import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, View } from 'react-native';
import Toast from 'react-native-toast-message';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react-native';

import PageLayout from '@/components/PageLayout';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { path } from '@/constants/path';
import { TRACKING_EVENTS } from '@/constants/tracking-events';
import { CARD_STATUS_QUERY_KEY } from '@/hooks/useCardStatus';
import { track } from '@/lib/analytics';
import { createDiditSession, getDiditVerificationStatus } from '@/lib/api';
import { withRefreshToken } from '@/lib/utils';

type SessionState =
  | { phase: 'loading' }
  | { phase: 'error'; message: string }
  | { phase: 'ready'; verificationUrl: string; sessionToken: string }
  | { phase: 'started' }
  | { phase: 'completed' };

export default function Kyc() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [session, setSession] = useState<SessionState>({ phase: 'loading' });
  const iframeContainerRef = useRef<HTMLDivElement | null>(null);
  const sdkInitializedRef = useRef(false);

  // Create Didit session on mount
  useEffect(() => {
    let cancelled = false;

    async function initSession() {
      try {
        track(TRACKING_EVENTS.KYC_LINK_PAGE_LOADED, { mode: 'didit' });
        const res = await withRefreshToken(() => createDiditSession());
        if (cancelled || !res) return;

        setSession({
          phase: 'ready',
          verificationUrl: res.verification_url,
          sessionToken: res.session_token,
        });
      } catch (e: any) {
        if (cancelled) return;
        const message =
          e?.message || 'Failed to create verification session';
        setSession({ phase: 'error', message });
        Toast.show({ type: 'error', text1: 'Error', text2: message });
      }
    }

    initSession();
    return () => {
      cancelled = true;
    };
  }, []);

  // On web: initialize Didit SDK when session is ready
  useEffect(() => {
    if (
      Platform.OS !== 'web' ||
      session.phase !== 'ready' ||
      sdkInitializedRef.current
    )
      return;

    sdkInitializedRef.current = true;

    async function startWebVerification() {
      if (session.phase !== 'ready') return;

      try {
        const DiditSdk = await import('@didit-protocol/sdk-web');
        const sdk = DiditSdk.DiditSdk ?? DiditSdk.default?.DiditSdk ?? DiditSdk;

        if (sdk?.shared?.startVerification) {
          sdk.shared.startVerification({ url: session.verificationUrl });
        } else if (sdk?.startVerification) {
          sdk.startVerification({ url: session.verificationUrl });
        } else if (typeof sdk === 'function') {
          sdk({ url: session.verificationUrl });
        }

        setSession({ phase: 'started' });
      } catch (err) {
        // Fallback: open verification_url in an iframe or new window
        console.warn('Didit SDK import failed, falling back to iframe:', err);
        if (iframeContainerRef.current && session.phase === 'ready') {
          const iframe = document.createElement('iframe');
          iframe.src = session.verificationUrl;
          iframe.style.width = '100%';
          iframe.style.height = '700px';
          iframe.style.border = 'none';
          iframe.style.borderRadius = '16px';
          iframe.allow = 'camera; microphone';
          iframeContainerRef.current.innerHTML = '';
          iframeContainerRef.current.appendChild(iframe);
          setSession({ phase: 'started' });
        }
      }
    }

    startWebVerification();
  }, [session]);

  // On native: start native SDK verification
  useEffect(() => {
    if (Platform.OS === 'web' || session.phase !== 'ready') return;

    async function startNativeVerification() {
      if (session.phase !== 'ready') return;

      try {
        const DiditSdk = await import('@didit-protocol/sdk-react-native');
        const sdk = DiditSdk.DiditSdk ?? DiditSdk.default ?? DiditSdk;

        if (sdk?.startVerification) {
          await sdk.startVerification({ token: session.sessionToken });
        }

        setSession({ phase: 'started' });
      } catch (err) {
        // Fallback: open in browser
        console.warn('Didit native SDK failed, falling back to browser:', err);
        const { openBrowserAsync, WebBrowserPresentationStyle } = await import(
          'expo-web-browser'
        );
        if (session.phase === 'ready') {
          await openBrowserAsync(session.verificationUrl, {
            presentationStyle: WebBrowserPresentationStyle.FULL_SCREEN,
            controlsColor: '#94F27F',
            toolbarColor: '#000000',
          });
        }
        setSession({ phase: 'started' });
      }
    }

    startNativeVerification();
  }, [session]);

  // Poll for verification status after SDK started
  useEffect(() => {
    if (session.phase !== 'started') return;

    const interval = setInterval(async () => {
      try {
        const status = await withRefreshToken(() =>
          getDiditVerificationStatus(),
        );
        if (!status) return;

        if (
          status.status === 'Approved' ||
          status.kycStatus === 'approved'
        ) {
          clearInterval(interval);
          setSession({ phase: 'completed' });
          queryClient.invalidateQueries({
            queryKey: [CARD_STATUS_QUERY_KEY],
          });
          Toast.show({
            type: 'success',
            text1: 'Verification complete',
            text2: 'Your identity has been verified.',
          });
          router.replace(String(path.CARD_ACTIVATE) as any);
        } else if (
          status.status === 'Declined' ||
          status.kycStatus === 'rejected'
        ) {
          clearInterval(interval);
          Toast.show({
            type: 'error',
            text1: 'Verification failed',
            text2:
              'Your identity verification was declined. Please try again.',
          });
          setSession({
            phase: 'error',
            message: 'Verification declined',
          });
        }
      } catch {
        // silently retry on network errors
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [session.phase, queryClient, router]);

  const handleRetry = useCallback(async () => {
    setSession({ phase: 'loading' });
    sdkInitializedRef.current = false;
    try {
      const res = await withRefreshToken(() => createDiditSession());
      if (!res) return;
      setSession({
        phase: 'ready',
        verificationUrl: res.verification_url,
        sessionToken: res.session_token,
      });
    } catch (e: any) {
      const message = e?.message || 'Failed to create verification session';
      setSession({ phase: 'error', message });
    }
  }, []);

  return (
    <PageLayout desktopOnly>
      <View className="mx-auto w-full max-w-lg flex-1 gap-8 px-4 pt-8">
        <View className="flex-row items-center justify-between">
          <Pressable
            onPress={() =>
              router.canGoBack() ? router.back() : router.replace('/')
            }
            className="flex h-10 w-10 items-center justify-center rounded-full border-0 bg-popover web:transition-colors web:hover:bg-muted"
          >
            <ArrowLeft size={24} color="#FFFFFF" />
          </Pressable>
          <Text className="text-center text-xl font-semibold text-white md:text-2xl">
            Verify identity
          </Text>
          <View style={{ width: 40 }} />
        </View>

        {session.phase === 'loading' && (
          <View className="flex-1 items-center justify-center py-20">
            <ActivityIndicator size="large" color="#94F27F" />
            <Text className="mt-4 text-center text-[#ACACAC]">
              Preparing verification...
            </Text>
          </View>
        )}

        {session.phase === 'error' && (
          <View className="flex-1 items-center justify-center gap-4 py-20">
            <Text className="text-center text-red-400">
              {session.message}
            </Text>
            <Button variant="brand" onPress={handleRetry} className="h-12 rounded-xl px-8">
              <Text className="font-semibold text-primary-foreground">
                Try again
              </Text>
            </Button>
          </View>
        )}

        {(session.phase === 'ready' || session.phase === 'started') && (
          <View className="flex-1">
            {Platform.OS === 'web' ? (
              <View className="flex-1">
                <div
                  ref={iframeContainerRef as any}
                  style={{ width: '100%', minHeight: 600 }}
                />
                {session.phase === 'started' && (
                  <Text className="mt-4 text-center text-sm text-[#ACACAC]">
                    Complete the verification in the widget above. This page
                    will update automatically when done.
                  </Text>
                )}
              </View>
            ) : (
              <View className="flex-1 items-center justify-center py-20">
                <ActivityIndicator size="large" color="#94F27F" />
                <Text className="mt-4 text-center text-[#ACACAC]">
                  Verification opened. Complete it and return here.
                </Text>
              </View>
            )}
          </View>
        )}

        {session.phase === 'completed' && (
          <View className="flex-1 items-center justify-center py-20">
            <Text className="text-center text-lg font-semibold text-[#94F27F]">
              Verification complete!
            </Text>
            <Text className="mt-2 text-center text-[#ACACAC]">
              Redirecting...
            </Text>
          </View>
        )}
      </View>
    </PageLayout>
  );
}
