import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useEffect } from 'react';
import { FlatList, View } from 'react-native';

import ActivateCardImageDesktop from '@/components/Card/ActivateCardImageDesktop';
import CardBenefits from '@/components/Card/CardBenefits';
import PageLayout from '@/components/PageLayout';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { path } from '@/constants/path';
import { useCardStatus } from '@/hooks/useCardStatus';
import { useDimension } from '@/hooks/useDimension';

export default function Card() {
  const router = useRouter();
  const { data: cardStatus, isLoading, error, refetch } = useCardStatus();
  const { isScreenMedium } = useDimension();

  useEffect(() => {
    if (isLoading) return;

    // If card exists (regardless of status), go to card details
    if (cardStatus?.status) {
      router.replace(path.CARD_DETAILS);
      return;
    }
  }, [cardStatus?.status, isLoading, error, router]);

  const activateCard = async () => {
    router.push(path.CARD_COUNTRY_SELECTION);
  };

  // Show error state for non-404 errors
  if (error && (error as any)?.status !== 404 && !isLoading) {
    return (
      <PageLayout>
        <View className="flex-1 justify-center items-center">
          <Text className="text-lg text-red-500">Error loading card status</Text>
          <Button className="mt-4" onPress={() => refetch()}>
            <Text>Retry</Text>
          </Button>
        </View>
      </PageLayout>
    );
  }

  // Mobile UI (existing)
  if (!isScreenMedium) {
    return (
      <>
        <View className="flex-1 justify-evenly items-center p-6 bg-background">
          <View>
            <Text className="text-4xl font-extrabold text-center">
              Introducing the{'\n'}Solid card
            </Text>
            <Text className="text-lg mt-2 font-medium text-center text-white/70 leading-[20px]">
              The world&apos;s first self-custodial{'\n'}Mastercard by Solid
            </Text>
          </View>

          <Image
            source={require('@/assets/images/activate_card.png')}
            alt="Activate Card"
            style={{ width: '70%', aspectRatio: 536 / 767 }}
            contentFit="contain"
          />

          <View className="w-full space-y-4">
            <Button className="rounded-xl h-14 w-full" onPress={activateCard}>
              <Text className="text-[20px] font-bold">Activate card</Text>
            </Button>
          </View>
        </View>
      </>
    );
  }

  // Desktop UI (following EmptyState pattern)
  const renderContent = () => (
    <View className="w-full max-w-7xl mx-auto gap-8 md:gap-16 px-4 py-8">
      <View className="md:flex-row justify-between md:items-center gap-y-4">
        <View className="gap-3">
          <Text className="text-3xl font-semibold">Solid Card</Text>
          <Text className="max-w-lg">
            <Text className="opacity-70">
              Our Solid vault will automatically manage your funds to maximize your yield without
              exposing you to unnecessary risk.
            </Text>
          </Text>
        </View>

        <View className="flex-row items-center gap-5">
          <Button
            className="rounded-xl h-12 px-10"
            style={{ backgroundColor: '#94F27F' }}
            onPress={activateCard}
          >
            <Text className="text-base font-bold text-black">Order Card</Text>
          </Button>
        </View>
      </View>

      <LinearGradient
        colors={['rgba(148, 242, 127, 0.23)', 'rgba(148, 242, 127, 0.05)']}
        style={{
          borderRadius: 20,
          padding: 40,
          paddingBottom: 0,
          gap: 96,
        }}
      >
        <View className="flex-col md:flex-row justify-between gap-10 md:gap-0">
          <View className="justify-between gap-10 md:gap-0 w-full max-w-2xl">
            <Text className="text-center md:text-start text-2xl md:text-4.5xl md:leading-10 font-semibold max-w-sm md:max-w-lg mx-auto md:mx-0">
              Introducing the Solid card
            </Text>
            <View className="pb-10">
              <CardBenefits />
            </View>
          </View>
          <ActivateCardImageDesktop />
        </View>
      </LinearGradient>
    </View>
  );

  return (
    <PageLayout desktopOnly scrollable={false} isLoading={isLoading}>
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
