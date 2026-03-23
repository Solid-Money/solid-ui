import { useState } from 'react';
import { View } from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import Toast from 'react-native-toast-message';
import { useQueryClient } from '@tanstack/react-query';

import { ActivateCardHeader } from '@/components/Card/ActivateCard';
import PageLayout from '@/components/PageLayout';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { path } from '@/constants/path';
import { CARD_STATUS_QUERY_KEY } from '@/hooks/useCardStatus';
import { createCard } from '@/lib/api';
import { getAsset } from '@/lib/assets';
import { CardStatus } from '@/lib/types';
import { withRefreshToken } from '@/lib/utils';

export default function CardReady() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [activating, setActivating] = useState(false);

  const handleGoBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.push(path.CARD);
    }
  };

  const handleActivateCard = async () => {
    try {
      setActivating(true);
      const card = await withRefreshToken(() => createCard());
      if (!card) throw new Error('Failed to create card');

      queryClient.invalidateQueries({ queryKey: [CARD_STATUS_QUERY_KEY] });

      if (card.status !== CardStatus.PENDING) {
        router.replace(path.CARD_DETAILS);
      } else {
        Toast.show({
          type: 'info',
          text1: 'Card activation in progress',
          text2: 'Your card is being set up. Please wait.',
          props: { badgeText: '' },
        });
        queryClient.invalidateQueries({ queryKey: [CARD_STATUS_QUERY_KEY] });
      }
    } catch (error) {
      console.error('Error activating card:', error);
      Toast.show({
        type: 'error',
        text1: 'Error activating card',
        text2: error instanceof Error ? error.message : 'Something went wrong. Please try again.',
        props: { badgeText: '' },
      });
    } finally {
      setActivating(false);
    }
  };

  return (
    <PageLayout desktopOnly contentClassName="pb-10">
      <View className="mx-auto w-full max-w-lg px-4 pt-8">
        <ActivateCardHeader onBack={handleGoBack} />

        <View className="mb-10 mt-8">
          <View className="items-center rounded-2xl border border-white/5 bg-[#1C1C1C] px-6 pb-8 pt-10">
            <View className="mb-6">
              <Image
                source={getAsset('images/card-fade.png')}
                alt="Solid Card"
                style={{ width: 200, height: 200 }}
                contentFit="contain"
              />
            </View>

            <Text className="mt-2 text-2xl font-bold text-white">Your card is ready!</Text>
            <Text className="my-3 text-center text-[#ACACAC]">
              All is set! now click on the "Activate card"{'\n'}button to issue your new card
            </Text>

            <Button
              variant="brand"
              onPress={handleActivateCard}
              disabled={activating}
              className="mt-4 h-14 w-full rounded-xl"
            >
              <Text className="text-base font-semibold text-primary-foreground">
                {activating ? 'Activating...' : 'Activate card'}
              </Text>
            </Button>
          </View>
        </View>
      </View>
    </PageLayout>
  );
}
