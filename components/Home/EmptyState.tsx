import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { View } from 'react-native';

import DashboardHeaderButtons from '@/components/Dashboard/DashboardHeaderButtons';
import { HomeBanners } from '@/components/Dashboard/HomeBanners';
import PageLayout from '@/components/PageLayout';
import SavingDepositImage from '@/components/Savings/SavingDepositImage';
import SavingsHeaderButtonsMobile from '@/components/Savings/SavingsHeaderButtonsMobile';
import { Text } from '@/components/ui/text';
import { useDimension } from '@/hooks/useDimension';
import DepositButton from './DepositButton';
import DepositDescription from './DepositDescription';
import DepositTitle from './DepositTitle';

export default function HomeEmptyState() {
  const { isScreenMedium } = useDimension();

  return (
    <PageLayout>
      <View className="mx-auto w-full max-w-7xl gap-[40px] px-4 pb-24 pt-6 md:pt-12">
        <View>
          {isScreenMedium ? (
            <View className="justify-between gap-y-4 md:flex-row md:items-center">
              <View className="flex-row items-baseline">
                <Text className="text-5xl font-semibold">$0</Text>
                <Text className="text-2xl">.00</Text>
              </View>
              <DashboardHeaderButtons />
            </View>
          ) : (
            <View className="flex-row items-baseline justify-center">
              <Text className="text-6xl font-semibold leading-normal">$0</Text>
              <Text className="text-3xl">.00</Text>
            </View>
          )}
        </View>

        <View className="gap-[1.875rem]">
          {!isScreenMedium && <SavingsHeaderButtonsMobile />}

          <View
            className="relative overflow-hidden md:min-h-96"
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
                    <DepositTitle />
                    <DepositDescription />
                  </View>
                  <View className="items-start">
                    <DepositButton />
                  </View>
                </View>
                <SavingDepositImage />
              </View>
            ) : (
              <View className="justify-between gap-y-6">
                <SavingDepositImage />
                <DepositTitle />
                <DepositDescription />
                <DepositButton />
              </View>
            )}
          </View>
        </View>
        <View className="mt-10 gap-6">
          <Text className="text-lg font-semibold text-muted-foreground">Promotions</Text>
          <HomeBanners />
        </View>
      </View>
    </PageLayout>
  );
}
