import { LinearGradient } from 'expo-linear-gradient';
import { Plus } from 'lucide-react-native';
import React from 'react';
import { FlatList, View } from 'react-native';

import { HomeBanners } from '@/components/Dashboard/HomeBanners';
import DepositOptionModal from '@/components/DepositOption/DepositOptionModal';
import { FAQs } from '@/components/FAQ';
import PageLayout from '@/components/PageLayout';
import { buttonVariants } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import faqs from '@/constants/faqs';
import { useDimension } from '@/hooks/useDimension';
import SavingDepositBenefits from './SavingDepositBenefits';
import SavingDepositImage from './SavingDepositImage';
import SavingDepositTitle from './SavingDepositTitle';

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
    <View className="w-full max-w-7xl mx-auto gap-[40px] px-4 pt-12 pb-8 md:pt-8">
      {isScreenMedium ? (
        <View className="md:flex-row justify-between md:items-center gap-y-4">
          <View className="flex-row items-center">
            <Text className="text-5xl font-semibold">$0</Text>
          </View>
          <View className="flex-row items-center gap-5">
            <DepositOptionModal />
          </View>
        </View>
      ) : (
        <View className="flex-row justify-center items-center">
          <Text className="text-5xl font-semibold">$0</Text>
        </View>
      )}

      <View className="gap-[1.875rem]">
        <LinearGradient
          colors={['rgba(156, 48, 235, 0.3)', 'rgba(156, 48, 235, 0.2)']}
          style={{
            borderRadius: 20,
            padding: isScreenMedium ? 60 : 20,
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
              <DepositOptionModal trigger={getTrigger()} />
            </View>
          )}
        </LinearGradient>
        <HomeBanners />
      </View>
      <FAQs faqs={faqs} className="md:mt-16" />
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
