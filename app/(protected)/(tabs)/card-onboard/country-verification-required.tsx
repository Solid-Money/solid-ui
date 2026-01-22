import React from 'react';
import { Pressable, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, MapPin, ShieldAlert } from 'lucide-react-native';

import CountryFlagImage from '@/components/CountryFlagImage';
import PageLayout from '@/components/PageLayout';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { COUNTRIES } from '@/constants/countries';
import { path } from '@/constants/path';
import { openIntercom } from '@/lib/intercom';

/**
 * Country Verification Required Screen
 *
 * Shown when device intelligence detects a mismatch between
 * the user's claimed country and their detected location.
 *
 * NOTE: We intentionally show a generic message without revealing
 * the specific reason (VPN, spoofing, etc.) to avoid helping
 * fraudsters bypass detection.
 */
export default function CountryVerificationRequired() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    claimedCountry: string;
    detectedCountry?: string;
  }>();

  const claimedCountry = COUNTRIES.find(c => c.code === params.claimedCountry);
  const detectedCountry = params.detectedCountry
    ? COUNTRIES.find(c => c.code === params.detectedCountry)
    : null;

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
              Unable to Verify Location
            </Text>

            {/* Explanation - Generic message */}
            <Text className="mb-6 text-center leading-6 text-[#ACACAC]">
              We couldn&apos;t verify that you&apos;re located in the country you selected. This
              verification helps us comply with financial regulations.
            </Text>

            {/* Country Comparison - Only show if we have detected country */}
            {detectedCountry && (
              <View className="mb-6 w-full rounded-xl bg-[#2A2A2A] p-4">
                <View className="flex-row items-center justify-between">
                  {/* Claimed Country */}
                  <View className="flex-1 items-center">
                    <Text className="mb-2 text-xs text-white/60">Selected</Text>
                    {claimedCountry ? (
                      <>
                        <CountryFlagImage
                          isoCode={claimedCountry.code}
                          size={48}
                          countryName={claimedCountry.name}
                        />
                        <Text className="mt-2 text-center text-sm text-white">
                          {claimedCountry.name}
                        </Text>
                      </>
                    ) : (
                      <Text className="text-white">{params.claimedCountry || 'Unknown'}</Text>
                    )}
                  </View>

                  {/* Arrow/Separator */}
                  <View className="mx-4 items-center">
                    <MapPin size={24} color="#FF6B6B" />
                    <Text className="mt-1 text-xs text-[#FF6B6B]">≠</Text>
                  </View>

                  {/* Detected Country */}
                  <View className="flex-1 items-center">
                    <Text className="mb-2 text-xs text-white/60">Detected</Text>
                    <CountryFlagImage
                      isoCode={detectedCountry.code}
                      size={48}
                      countryName={detectedCountry.name}
                    />
                    <Text className="mt-2 text-center text-sm text-white">
                      {detectedCountry.name}
                    </Text>
                  </View>
                </View>
              </View>
            )}

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
