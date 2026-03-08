import React, { useEffect } from 'react';
import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import { DiditSdk } from '@didit-protocol/sdk-web';

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

  const verificationUrl =
    session.phase === 'ready' ? session.verificationUrl : null;

  useEffect(() => {
    if (!verificationUrl || sdkInitializedRef.current) return;

    sdkInitializedRef.current = true;

    try {
      DiditSdk.startVerification({ url: verificationUrl });
      markStarted();
    } catch {
      sdkInitializedRef.current = false;
      initSession();
    }
  }, [verificationUrl, sdkInitializedRef, markStarted, initSession]);

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
          <Text className="mt-4 text-center text-sm text-[#ACACAC]">
            Complete the verification in the Didit window. This page will
            update automatically when done.
          </Text>
        )}

        {session.phase === 'completed' && <KycCompleted />}
      </View>
    </PageLayout>
  );
}
