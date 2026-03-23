import { useState } from 'react';
import Toast from 'react-native-toast-message';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';

import { CardStatusPage } from '@/components/Card/CardStatusPage';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { path } from '@/constants/path';
import { CARD_STATUS_QUERY_KEY } from '@/hooks/useCardStatus';
import { createCard } from '@/lib/api';
import { CardStatus } from '@/lib/types';
import { withRefreshToken } from '@/lib/utils';

export default function CardReady() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [activating, setActivating] = useState(false);

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
    <CardStatusPage
      title="Your card is ready!"
      description={'All is set! now click on the "Activate card"\nbutton to issue your new card'}
    >
      <Button
        variant="brand"
        onPress={handleActivateCard}
        disabled={activating}
        className="mt-4 h-12 w-full rounded-xl"
      >
        <Text className="text-base font-bold text-primary-foreground">
          {activating ? 'Activating...' : 'Activate card'}
        </Text>
      </Button>
    </CardStatusPage>
  );
}
