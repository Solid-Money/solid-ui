import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { FlatList, View } from 'react-native';

import DashboardHeaderButtons from '@/components/Dashboard/DashboardHeaderButtons';
import { HomeBanners } from '@/components/Dashboard/HomeBanners';
import PageLayout from '@/components/PageLayout';
import { Text } from '@/components/ui/text';
import { useDimension } from '@/hooks/useDimension';
import SavingDepositButton from './SavingDepositButton';
import SavingDepositDescription from './SavingDepositDescription';
import SavingDepositImage from './SavingDepositImage';
import SavingDepositTitle from './SavingDepositTitle';
import SavingsHeaderButtonsMobile from './SavingsHeaderButtonsMobile';

export default function SavingsEmptyState() {
  const { isScreenMedium } = useDimension();

  const renderContent = () => (
    <View className="mx-auto w-full max-w-7xl gap-[40px] pb-8 pt-6 md:pt-12">
      <View className="px-4">
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

      <View className="gap-[1.875rem] px-4">
        {!isScreenMedium && <SavingsHeaderButtonsMobile />}

        <View
          className="relative overflow-hidden"
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
            <View className="flex-col justify-between gap-10 md:flex-row md:gap-0">
              <View className="w-full max-w-2xl justify-between gap-10 md:gap-0">
                <View className="gap-4">
                  <SavingDepositTitle />
                  <SavingDepositDescription />
                </View>
                <View className="items-start">
                  <SavingDepositButton />
                </View>
              </View>
              <View>
                <SavingDepositImage />
              </View>
            </View>
          ) : (
            <View className="justify-between gap-y-6">
              <SavingDepositImage />
              <SavingDepositTitle />
              <SavingDepositDescription />
              <SavingDepositButton />
            </View>
          )}
        </View>
      </View>
      <View className="mt-10 gap-6 px-4 md:px-0">
        <Text className="text-lg font-semibold text-muted-foreground">Promotions</Text>
        <HomeBanners />
      </View>
    </View>
  );

  return (
    <PageLayout scrollable={false}>
      <FlatList
        data={[{ key: 'content' }]}
        renderItem={() => renderContent()}
        keyExtractor={item => item.key}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ flexGrow: 1, paddingBottom: 100 }}
      />
    </PageLayout>
  );
}
