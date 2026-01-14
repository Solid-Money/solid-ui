import React from 'react';
import { View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import DashboardHeaderButtons from '@/components/Dashboard/DashboardHeaderButtons';
import FAQs from '@/components/FAQ/FAQs';
import PageLayout from '@/components/PageLayout';
import { Text } from '@/components/ui/text';
import faqs from '@/constants/faqs';
import { VAULTS } from '@/constants/vaults';
import { useDimension } from '@/hooks/useDimension';

import SavingDepositBenefits from './SavingDepositBenefits';
import SavingDepositButton from './SavingDepositButton';
import SavingDepositDescription from './SavingDepositDescription';
import SavingDepositImage from './SavingDepositImage';
import SavingDepositTitle from './SavingDepositTitle';
import SavingsHeaderButtonsMobile from './SavingsHeaderButtonsMobile';
import SavingVault from './SavingVault';

export default function SavingsEmptyState() {
  const { isScreenMedium } = useDimension();

  return (
    <PageLayout>
      <View className="mx-auto w-full max-w-7xl gap-[40px] px-4 pb-24 pt-6 md:pt-12">
        <View>
          {isScreenMedium ? (
            <View className="flex-row items-center justify-between">
              <Text className="text-5xl font-semibold">Savings</Text>
              <DashboardHeaderButtons />
            </View>
          ) : (
            <Text className="text-3xl font-semibold">Savings</Text>
          )}
        </View>

        <View className="gap-[1.875rem]">
          <View className="gap-3 md:flex-row md:gap-6">
            <View className="gap-5">
              {VAULTS.map(vault => (
                <SavingVault key={vault.name} vault={vault} />
              ))}
            </View>

            <View
              className="relative flex-1 overflow-hidden md:min-h-96"
              style={{
                borderRadius: 20,
                padding: isScreenMedium ? 40 : 20,
                gap: isScreenMedium ? 96 : 40,
              }}
            >
              <LinearGradient
                colors={['rgba(122, 84, 234, 1)', 'rgba(122, 84, 234, 0.5)']}
                start={{ x: 0.5, y: 0 }}
                end={{ x: 0.6, y: 1 }}
                pointerEvents="none"
                style={{
                  position: 'absolute',
                  left: 0,
                  right: 0,
                  top: 0,
                  bottom: 0,
                  zIndex: -1,
                  opacity: 0.3,
                }}
              />
              {isScreenMedium ? (
                <View className="relative flex-1 flex-col justify-between gap-10 md:flex-row md:gap-0">
                  <View className="w-full max-w-2xl justify-between gap-10 md:gap-0">
                    <View className="gap-4">
                      <SavingDepositTitle />
                      <SavingDepositDescription />
                    </View>
                    <View className="items-start">
                      <SavingDepositButton />
                    </View>
                  </View>
                  <SavingDepositImage />
                </View>
              ) : (
                <View className="justify-between gap-y-6">
                  <SavingDepositImage />
                  <SavingDepositTitle />
                  <SavingDepositBenefits />
                  <SavingDepositButton />
                </View>
              )}
            </View>
          </View>

          {!isScreenMedium && <SavingsHeaderButtonsMobile />}
        </View>
        <FAQs faqs={faqs} className="md:mt-20" />
      </View>
    </PageLayout>
  );
}
