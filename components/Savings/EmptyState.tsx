import { LinearGradient } from 'expo-linear-gradient';
import { Link } from 'expo-router';
import React from 'react';
import { Platform, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DepositOptionModal } from '@/components/DepositOption';
import { FAQs } from '@/components/FAQ';
import Navbar from '@/components/Navbar';
import NavbarMobile from '@/components/Navbar/NavbarMobile';
import { Text } from '@/components/ui/text';
import faqs from '@/constants/faqs';
import { useDimension } from '@/hooks/useDimension';
import SavingDepositBenefits from './SavingDepositBenefits';
import SavingDepositImage from './SavingDepositImage';
import SavingDepositTitle from './SavingDepositTitle';

export default function SavingsEmptyState() {
  const { isScreenMedium } = useDimension();

  return (
    <SafeAreaView
      className="bg-background text-foreground flex-1"
      edges={['right', 'left', 'bottom', 'top']}
    >
      <ScrollView className="flex-1">
        {Platform.OS !== 'web' && <NavbarMobile />}
        {Platform.OS === 'web' && <Navbar />}
        <View className="w-full max-w-7xl mx-auto gap-12 md:gap-16 px-4 pt-4 pb-8">
          {isScreenMedium ? (
            <View className="md:flex-row justify-between md:items-center gap-y-4">
              <View className="gap-3">
                <Text className="text-3xl font-semibold">Your saving account</Text>
                <Text className="max-w-lg">
                  <Text className="opacity-70">
                    Our Solid vault will automatically manage your funds to maximize your yield
                    without exposing you to unnecessary risk.
                  </Text>{' '}
                  <Link
                    href="https://solid-3.gitbook.io/solid.xyz-docs"
                    target="_blank"
                    className="text-primary font-medium underline hover:opacity-70"
                  >
                    How it works
                  </Link>
                </Text>
              </View>

              <View className="flex-row items-center gap-5">
                <DepositOptionModal />
              </View>
            </View>
          ) : (
            <Text className="text-xl font-semibold">Savings</Text>
          )}

          <LinearGradient
            colors={['rgba(156, 48, 235, 0.3)', 'rgba(156, 48, 235, 0.2)']}
            style={{
              borderRadius: 20,
              padding: isScreenMedium ? 40 : 20,
              gap: isScreenMedium ? 96 : 40,
            }}
          >
            {isScreenMedium ? (
              <View className="flex-col md:flex-row justify-between gap-10 md:gap-0">
                <View className="justify-between gap-10 md:gap-0 w-full max-w-2xl">
                  <SavingDepositTitle />
                  <SavingDepositBenefits />
                </View>
                <View>
                  <SavingDepositImage />
                </View>
              </View>
            ) : (
              <View className="justify-between gap-y-6">
                <SavingDepositImage />
                <SavingDepositTitle />
                <SavingDepositBenefits />
              </View>
            )}
          </LinearGradient>
          {!isScreenMedium && <DepositOptionModal />}
          <FAQs faqs={faqs} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
