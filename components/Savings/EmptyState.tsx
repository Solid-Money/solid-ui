import React from 'react';
import { ScrollView, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import DashboardHeaderButtons from '@/components/Dashboard/DashboardHeaderButtons';
import DepositTrigger from '@/components/DepositOption/DepositTrigger';
import FAQs from '@/components/FAQ/FAQs';
import PageLayout from '@/components/PageLayout';
import { Text } from '@/components/ui/text';
import faqs from '@/constants/faqs';
import { DEPOSIT_MODAL } from '@/constants/modals';
import { VAULTS } from '@/constants/vaults';
import { useDimension } from '@/hooks/useDimension';
import { useDepositStore } from '@/store/useDepositStore';

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
              <View className="flex-row gap-2">
                <DashboardHeaderButtons hideSend hideDeposit />
                <DepositTrigger
                  buttonText="Deposit"
                  modal={DEPOSIT_MODAL.OPEN_FORM}
                  preserveSelectedVault
                  source="savings_empty_state_header"
                  onBeforeOpen={() => {
                    useDepositStore.getState().setDepositFromSolid(true);
                  }}
                />
              </View>
            </View>
          ) : (
            <Text className="text-3xl font-semibold">Savings</Text>
          )}
        </View>

        <View className="gap-[1.875rem]">
          {isScreenMedium ? (
            <View className="flex-row gap-4">
              <View className="flex-col gap-4">
                {VAULTS.map(vault => (
                  <SavingVault key={vault.name} vault={vault} />
                ))}
              </View>
              <View
                className="relative flex-1 overflow-hidden md:min-h-96"
                style={{
                  borderRadius: 20,
                  padding: 40,
                  gap: 96,
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
              </View>
            </View>
          ) : (
            <>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 16, paddingHorizontal: 4 }}
                style={{ marginHorizontal: -4 }}
              >
                {VAULTS.map(vault => (
                  <SavingVault key={vault.name} vault={vault} />
                ))}
              </ScrollView>
              <View
                className="relative overflow-hidden"
                style={{
                  borderRadius: 20,
                  padding: 20,
                  gap: 40,
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
                <View className="justify-between gap-y-6">
                  <SavingDepositImage />
                  <SavingDepositTitle />
                  <SavingDepositBenefits />
                  <SavingDepositButton />
                </View>
              </View>
            </>
          )}

          {!isScreenMedium && <SavingsHeaderButtonsMobile hideSend />}
        </View>
        <FAQs faqs={faqs} className="md:mt-20" />
      </View>
    </PageLayout>
  );
}
