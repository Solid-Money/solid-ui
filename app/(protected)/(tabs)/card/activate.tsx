import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';

import { AnimatedStepContent } from '@/components/Card/AnimatedStepContent';
import { StepIndicator } from '@/components/Card/StepIndicator';
import PageLayout from '@/components/PageLayout';
import { Text } from '@/components/ui/text';
import { path } from '@/constants/path';
import { useCardSteps } from '@/hooks/useCardSteps';
import { checkCardAccess, getClientIp, getCountryFromIp } from '@/lib/api';
import { KycStatus } from '@/lib/types';
import { withRefreshToken } from '@/lib/utils';
import { useCountryStore } from '@/store/useCountryStore';

export default function ActivateMobile() {
  const { kycLink: _kycLink, kycStatus: _kycStatus } = useLocalSearchParams<{
    kycLink?: string;
    kycStatus?: KycStatus;
  }>();

  const { steps, activeStepId, isStepButtonEnabled, toggleStep, activatingCard } = useCardSteps(
    _kycStatus as KycStatus | undefined,
  );

  const router = useRouter();
  const [checkingCountry, setCheckingCountry] = useState(true);

  const {
    countryInfo,
    setCountryInfo,
    getIpDetectedCountry,
    setIpDetectedCountry,
    getCachedIp,
    setCachedIp,
    countryDetectionFailed,
    setCountryDetectionFailed,
  } = useCountryStore();

  // Check country availability on mount
  useEffect(() => {
    const checkCountry = async () => {
      try {
        // First check if we have valid cached country info
        if (countryInfo) {
          // If country is available, proceed with activation
          if (countryInfo.isAvailable) {
            setCheckingCountry(false);
            return;
          }
          // If country is not available, redirect to country selection
          router.replace(path.CARD_ACTIVATE_COUNTRY_SELECTION);
          return;
        }

        // Try to get cached IP
        let ip = getCachedIp();

        // If no cached IP, fetch a new one
        if (!ip) {
          ip = await getClientIp();
          if (ip) {
            setCachedIp(ip);
          } else {
            // If IP detection fails, redirect to country selection
            router.replace(path.CARD_ACTIVATE_COUNTRY_SELECTION);
            return;
          }
        }

        // Check if we have valid cached country info for this IP
        const cachedInfo = getIpDetectedCountry(ip);
        if (cachedInfo) {
          setCountryInfo(cachedInfo);

          if (cachedInfo.isAvailable) {
            setCheckingCountry(false);
            return;
          } else {
            router.replace(path.CARD_ACTIVATE_COUNTRY_SELECTION);
            return;
          }
        }

        // If country detection already failed, redirect to selection
        if (countryDetectionFailed) {
          router.replace(path.CARD_ACTIVATE_COUNTRY_SELECTION);
          return;
        }

        // Fetch country from IP and check access
        const countryData = await getCountryFromIp();
        if (!countryData) {
          setCountryDetectionFailed(true);
          router.replace(path.CARD_ACTIVATE_COUNTRY_SELECTION);
          return;
        }

        const { countryCode, countryName } = countryData;

        // Check card access
        const accessCheck = await withRefreshToken(() => checkCardAccess(countryCode));
        if (!accessCheck) {
          setCountryDetectionFailed(true);
          router.replace(path.CARD_ACTIVATE_COUNTRY_SELECTION);
          return;
        }

        const newCountryInfo = {
          countryCode,
          countryName,
          isAvailable: accessCheck.hasAccess,
        };

        // Cache the country info
        setIpDetectedCountry(ip, newCountryInfo);
        setCountryDetectionFailed(false);

        if (newCountryInfo.isAvailable) {
          setCheckingCountry(false);
        } else {
          router.replace(path.CARD_ACTIVATE_COUNTRY_SELECTION);
        }
      } catch (error) {
        console.error('Error checking country:', error);
        setCountryDetectionFailed(true);
        router.replace(path.CARD_ACTIVATE_COUNTRY_SELECTION);
      }
    };

    checkCountry();
  }, [
    router,
    countryInfo,
    getIpDetectedCountry,
    setIpDetectedCountry,
    getCachedIp,
    setCachedIp,
    setCountryInfo,
    countryDetectionFailed,
    setCountryDetectionFailed,
  ]);

  // Show loading state while checking country
  if (checkingCountry) {
    return (
      <PageLayout desktopOnly contentClassName="pb-10">
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#94F27F" />
          <Text className="mt-4 text-white/70">Checking availability...</Text>
        </View>
      </PageLayout>
    );
  }

  return (
    <PageLayout desktopOnly contentClassName="pb-10">
      <View className="w-full max-w-lg mx-auto pt-8 px-4">
        <View className="flex-row items-center justify-between">
          <Pressable
            onPress={() => (router.canGoBack() ? router.back() : router.push(path.CARD))}
            className="web:hover:opacity-70"
          >
            <ArrowLeft color="white" />
          </Pressable>
          <Text className="text-white text-xl md:text-2xl font-semibold text-center">
            Solid card
          </Text>
          <View className="w-10" />
        </View>
        <View className="items-center justify-center mt-8">
          <Image
            source={require('@/assets/images/activate_card_steps.png')}
            alt="Solid Card"
            style={{ width: '100%', aspectRatio: 512 / 306 }}
            contentFit="contain"
          />
        </View>

        {/* Card issuance status */}
        <View className="mt-8 mb-4">
          <Text className="text-lg font-medium text-white/70 mb-4">Card issuance status</Text>

          <View className="bg-[#333331] rounded-xl p-6">
            {steps.map((step, index) => (
              <View
                key={step.id}
                className={`flex-row items-start space-x-4 ${index < steps.length - 1 ? 'mb-4' : ''}`}
              >
                <StepIndicator
                  stepId={step.id}
                  completed={step.completed}
                  onPress={() => toggleStep(step.id)}
                />

                <View className="flex-1 ml-4 mt-1">
                  <Pressable onPress={() => toggleStep(step.id)}>
                    <Text className="text-lg font-semibold text-white mb-1">{step.title}</Text>
                  </Pressable>

                  <AnimatedStepContent
                    step={step}
                    isActive={activeStepId === step.id}
                    isButtonEnabled={isStepButtonEnabled(index)}
                    activatingCard={activatingCard}
                  />
                </View>
              </View>
            ))}
          </View>
        </View>
      </View>
    </PageLayout>
  );
}
