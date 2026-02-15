import React from 'react';
import { View } from 'react-native';
import { Image, ImageSource } from 'expo-image';

import DashboardHeaderButtons from '@/components/Dashboard/DashboardHeaderButtons';
import { HomeBanners } from '@/components/Dashboard/HomeBanners';
import PageLayout from '@/components/PageLayout';
import SavingsHeaderButtonsMobile from '@/components/Savings/SavingsHeaderButtonsMobile';
import { Text } from '@/components/ui/text';
import { useMaxAPY } from '@/hooks/useAnalytics';
import { useDimension } from '@/hooks/useDimension';
import { getAsset } from '@/lib/assets';
import { cn, formatNumber } from '@/lib/utils';

import DepositButton from './DepositButton';
import DepositDescription from './DepositDescription';
import DepositImage from './DepositImage';

const BENEFIT_DESCRIPTION =
  "Solid's automation engine puts your USDC to work across institutional-grade yield strategies.";

export default function HomeEmptyState() {
  const { isScreenMedium } = useDimension();
  const { maxAPY, isAPYsLoading } = useMaxAPY();

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
              <DashboardHeaderButtons disableWithdraw disableSend disableSwap />
            </View>
          ) : (
            <View className="flex-row items-baseline justify-center">
              <Text className="text-6xl font-semibold leading-normal">$0</Text>
              <Text className="text-3xl">.00</Text>
            </View>
          )}
        </View>

        <View className="gap-10 md:gap-20">
          {!isScreenMedium && (
            <SavingsHeaderButtonsMobile disableWithdraw disableSend disableSwap />
          )}

          {/* Welcome to Solid */}
          <View className="md:items-between gap-4 overflow-hidden rounded-twice bg-card px-5 py-6 md:min-h-80 md:flex-row md:justify-between md:gap-12 md:px-10 md:py-10">
            {isScreenMedium ? (
              <>
                <View className="max-w-2xl flex-1 justify-between gap-6">
                  <View className="gap-3">
                    <Text className="text-4.5xl font-semibold text-foreground">
                      Welcome to Solid
                    </Text>
                    <DepositDescription />
                  </View>
                  <DepositButton />
                </View>
                <DepositImage />
              </>
            ) : (
              <>
                <DepositImage />
                <View className="items-center gap-3">
                  <Text className="text-2xl font-bold text-foreground">Welcome to Solid</Text>
                  <DepositDescription />
                </View>
                <DepositButton />
              </>
            )}
          </View>

          {/* Solid benefits */}
          <View className="gap-4">
            <Text className="text-lg font-semibold text-foreground/50">Solid benefits</Text>
            <View className="gap-10 rounded-twice bg-card px-5 py-6 md:flex-row md:gap-4 md:gap-5 md:p-10">
              <SolidBenefitCard
                icon={getAsset('images/rocket-lavender.png')}
                headline={
                  isAPYsLoading ? (
                    'Get yield on your USDC'
                  ) : (
                    <>
                      Get{' '}
                      <Text className="text-3xl font-semibold leading-[1.1] text-brand">
                        {formatNumber(maxAPY ?? 0, 1)}%
                      </Text>{' '}
                      yield on your USDC
                    </>
                  )
                }
                description={BENEFIT_DESCRIPTION}
              />
              <SolidBenefitCard
                icon={getAsset('images/dollar-lavender.png')}
                headline="Spend while you earn"
                description={BENEFIT_DESCRIPTION}
                classNames={{
                  headline: 'max-w-56',
                }}
              />
              <SolidBenefitCard
                icon={getAsset('images/flash-lavender.png')}
                headline="Your stablecoins super-app"
                description={BENEFIT_DESCRIPTION}
              />
            </View>
          </View>

          <View className="gap-6">
            <Text className="text-lg font-semibold text-foreground/50">For you</Text>
            <HomeBanners />
          </View>
        </View>
      </View>
    </PageLayout>
  );
}

function SolidBenefitCard({
  icon,
  headline,
  description,
  classNames,
}: {
  icon: ImageSource;
  headline: React.ReactNode;
  description: string;
  classNames?: {
    headline?: string;
    description?: string;
  };
}) {
  return (
    <View className="flex-1 gap-4 md:min-w-0">
      <Image source={icon} style={{ width: 40, height: 40 }} contentFit="contain" />
      <Text
        className={cn(
          'max-w-64 text-3xl font-semibold leading-[1.1] text-foreground',
          classNames?.headline,
        )}
      >
        {headline}
      </Text>
      <Text
        className={cn(
          'max-w-xs text-lg font-medium leading-tight text-muted-foreground',
          classNames?.description,
        )}
      >
        {description}
      </Text>
    </View>
  );
}
