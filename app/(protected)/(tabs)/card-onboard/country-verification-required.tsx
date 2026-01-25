import React from 'react';
import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowLeft, ShieldAlert } from 'lucide-react-native';

import PageLayout from '@/components/PageLayout';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { path } from '@/constants/path';
import { openIntercom } from '@/lib/intercom';

/**
 * Verification Failed Screen
 *
 * Shown when device intelligence detects an issue during verification.
 *
 * SECURITY NOTE: We intentionally show a generic message without revealing
 * the specific reason (VPN, location spoofing, device tampering, etc.)
 * to avoid helping fraudsters identify and bypass our detection methods.
 */
export default function CountryVerificationRequired() {
  const router = useRouter();

  const goBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.push(path.CARD);
    }
  };

  const handleTryAgain = () => {
    router.replace(path.CARD_COUNTRY_SELECTION);
  };

  const handleContactSupport = () => {
    openIntercom();
  };

  return (
    <PageLayout desktopOnly>
      <View className="mx-auto w-full max-w-lg px-4 pt-12">
        {/* Header */}
        <View className="mb-10 flex-row items-center justify-between">
          <Pressable onPress={goBack} className="web:hover:opacity-70">
            <ArrowLeft color="white" />
          </Pressable>
          <Text className="text-center text-xl font-semibold text-white md:text-2xl">
            Verification Required
          </Text>
          <View className="w-10" />
        </View>

        {/* Content */}
        <View className="flex-1 justify-center">
          <View className="w-full items-center rounded-[20px] bg-[#1C1C1C] px-6 py-8">
            {/* Warning Icon */}
            <View className="mb-6 h-20 w-20 items-center justify-center rounded-full bg-[#FF6B6B]/20">
              <ShieldAlert size={40} color="#FF6B6B" />
            </View>

            {/* Title */}
            <Text className="mb-4 text-center text-2xl font-bold text-white">
              Verification Failed
            </Text>

            {/* Explanation - Intentionally generic to not help fraudsters */}
            <Text className="mb-6 text-center leading-6 text-[#ACACAC]">
              We couldn&apos;t complete verification at this time. This check helps us comply with
              financial regulations and protect your account.
            </Text>

            {/* Instructions */}
            <Text className="mb-6 text-center text-sm leading-5 text-white/70">
              If you believe this is an error, please contact our support team for assistance.
            </Text>

            {/* Actions */}
            <View className="w-full gap-3">
              <Button
                className="h-11 w-full rounded-xl bg-[#94F27F]"
                onPress={handleContactSupport}
              >
                <Text className="text-base font-bold text-black">Contact Support</Text>
              </Button>

              <Button
                className="h-11 w-full rounded-xl border border-white/30 bg-transparent"
                onPress={handleTryAgain}
              >
                <Text className="text-base font-bold text-white">Try Again</Text>
              </Button>
            </View>
          </View>
        </View>
      </View>
    </PageLayout>
  );
}
