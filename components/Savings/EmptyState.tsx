import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { FlatList, View } from 'react-native';

import { HomeBanners } from '@/components/Dashboard/HomeBanners';
import PageLayout from '@/components/PageLayout';
import { Text } from '@/components/ui/text';
import { useDimension } from '@/hooks/useDimension';
import SavingDepositImage from './SavingDepositImage';
import SavingDepositTitle from './SavingDepositTitle';
import SavingsHeaderButtonsMobile from './SavingsHeaderButtonsMobile';
import DashboardHeaderButtons from '@/components/Dashboard/DashboardHeaderButtons';
import SavingDepositDescription from './SavingDepositDescription';
import SavingDepositButton from './SavingDepositButton';

export default function SavingsEmptyState() {
  const { isScreenMedium } = useDimension();

  const renderContent = () => (
    <View className="w-full max-w-7xl mx-auto gap-[40px] pt-12 pb-8">
      <View className="px-4">
        {isScreenMedium ? (
          <View className="md:flex-row justify-between md:items-center gap-y-4">
            <View className="flex-row items-baseline">
              <Text className="text-5xl font-semibold">$0</Text>
              <Text className="text-2xl">.00</Text>
            </View>
            <DashboardHeaderButtons />
          </View>
        ) : (
          <View className="flex-row justify-center items-baseline">
            <Text className="text-5xl font-semibold">$0</Text>
            <Text className="text-2xl">.00</Text>
          </View>
        )}
      </View>

      <View className="gap-[1.875rem] px-4">
        {!isScreenMedium && <SavingsHeaderButtonsMobile />}

        <LinearGradient
          colors={['rgba(122, 84, 234, 0.3)', 'rgba(122, 84, 234, 0.2)']}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.6, y: 1 }}
          style={{
            borderRadius: 20,
            padding: isScreenMedium ? 40 : 20,
            gap: isScreenMedium ? 96 : 40,
          }}
        >
          {isScreenMedium ? (
            <View className="flex-col md:flex-row justify-between gap-10 md:gap-0">
              <View className="justify-between gap-10 md:gap-0 w-full max-w-2xl">
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
        </LinearGradient>
      </View>
      <View className="px-4 md:px-0 mt-10 gap-6">
        <Text className="text-lg text-muted-foreground font-semibold">Promotions</Text>
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
