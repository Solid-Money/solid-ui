import React, { useEffect, useRef } from 'react';
import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';

import PageLayout from '@/components/PageLayout';
import { Text } from '@/components/ui/text';
import {
  useDiditSession,
  KycLoading,
  KycError,
  KycCompleted,
} from '@/components/kyc';

export default function KycWeb() {
  const router = useRouter();
  const { session, sdkInitializedRef, initSession, markStarted } =
    useDiditSession();
  const iframeContainerRef = useRef<HTMLDivElement | null>(null);

  const verificationUrl =
    session.phase === 'ready' ? session.verificationUrl : null;

  // On web: initialize Didit SDK when session is ready
  useEffect(() => {
    if (!verificationUrl || sdkInitializedRef.current) return;

    sdkInitializedRef.current = true;

    async function startWebVerification() {
      if (!verificationUrl) return;

      try {
        const DiditSdk = await import('@didit-protocol/sdk-web');
        const sdk =
          DiditSdk.DiditSdk ?? DiditSdk.default?.DiditSdk ?? DiditSdk;

        if (sdk?.shared?.startVerification) {
          sdk.shared.startVerification({ url: verificationUrl });
        } else if (sdk?.startVerification) {
          sdk.startVerification({ url: verificationUrl });
        } else if (typeof sdk === 'function') {
          sdk({ url: verificationUrl });
        }

        markStarted();
      } catch (err) {
        // Fallback: open verification_url in an iframe
        console.warn('Didit SDK import failed, falling back to iframe:', err);
        if (iframeContainerRef.current && verificationUrl) {
          const iframe = document.createElement('iframe');
          iframe.src = verificationUrl;
          iframe.style.width = '100%';
          iframe.style.height = '700px';
          iframe.style.border = 'none';
          iframe.style.borderRadius = '16px';
          iframe.allow = 'camera; microphone';
          iframeContainerRef.current.innerHTML = '';
          iframeContainerRef.current.appendChild(iframe);
          markStarted();
        }
      }
    }

    startWebVerification();
  }, [verificationUrl, sdkInitializedRef, markStarted]);

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

        {session.phase === 'loading' && <KycLoading />}

        {session.phase === 'error' && (
          <KycError message={session.message} onRetry={initSession} />
        )}

        {(session.phase === 'ready' || session.phase === 'started') && (
          <View className="flex-1">
            <div
              ref={iframeContainerRef as any}
              style={{ width: '100%', minHeight: 600 }}
            />
            {session.phase === 'started' && (
              <Text className="mt-4 text-center text-sm text-[#ACACAC]">
                Complete the verification in the widget above. This page will
                update automatically when done.
              </Text>
            )}
          </View>
        )}

        {session.phase === 'completed' && <KycCompleted />}
      </View>
    </PageLayout>
  );
}
