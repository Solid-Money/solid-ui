import { LinearGradient } from 'expo-linear-gradient';
import { Plus } from 'lucide-react-native';
import React from 'react';
import { FlatList, View } from 'react-native';

import { HomeBanners } from '@/components/Dashboard/HomeBanners';
import DepositOptionModal from '@/components/DepositOption/DepositOptionModal';
import PageLayout from '@/components/PageLayout';
import { buttonVariants } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { useDimension } from '@/hooks/useDimension';
import SavingDepositBenefits from './SavingDepositBenefits';
import SavingDepositImage from './SavingDepositImage';
import SavingDepositTitle from './SavingDepositTitle';
import SavingsHeaderButtonsMobile from './SavingsHeaderButtonsMobile';
import DashboardHeaderButtons from '@/components/Dashboard/DashboardHeaderButtons';
import SavingDepositDescription from './SavingDepositDescription';
import SavingDepositButton from './SavingDepositButton';

export default function SavingsEmptyState() {
  const { isScreenMedium } = useDimension();

  const getTrigger = () => {
    return (
      <View
        className={buttonVariants({
          variant: 'purple',
          className: 'h-12 pr-6 rounded-xl',
        })}
      >
        <View className="flex-row items-center gap-1">
          <Plus color="white" />
          <Text className="font-bold">Add funds</Text>
        </View>
      </View>
    );
  };

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
          <View className="flex-row justify-center items-center">
            <Text className="text-5xl font-semibold">$0</Text>
          </View>
        )}
      </View>

      <View className="gap-[1.875rem] px-4">
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
              <SavingDepositBenefits />
              <DepositOptionModal trigger={getTrigger()} />
            </View>
          )}
        </LinearGradient>

        {!isScreenMedium && <SavingsHeaderButtonsMobile />}
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
