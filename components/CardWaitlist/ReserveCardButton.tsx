import { useState } from 'react';
import { ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';

import { NotificationEmailModalDialog } from '@/components/NotificationEmailModal/NotificationEmailModalDialog';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { path } from '@/constants/path';
import { TRACKING_EVENTS } from '@/constants/tracking-events';
import useUser from '@/hooks/useUser';
import { track } from '@/lib/analytics';
import { addToCardWaitlist } from '@/lib/api';
import { resolveCountryAccess } from '@/lib/countryAccess';
import { withRefreshToken } from '@/lib/utils';

export type DetectedCountryInfo = {
  countryCode: string;
  countryName: string;
};

const ReserveCardButton = () => {
  const router = useRouter();
  const { user } = useUser();
  const [loading, setLoading] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);

  const [detectedCountryInfo, setDetectedCountryInfo] = useState<DetectedCountryInfo | null>(null);

  const handleAddToWaitlist = async (countryCode: string) => {
    if (user?.email) {
      try {
        await withRefreshToken(() => addToCardWaitlist(user.email!, countryCode.toUpperCase()));
        track(TRACKING_EVENTS.CARD_WAITLIST_COMPLETED, {
          user_id: user?.userId,
          email: user?.email,
          country_code: countryCode.toUpperCase(),
        });
        router.push(path.CARD_WAITLIST_SUCCESS);
      } catch (error) {
        console.error('Error adding to card waitlist:', error);
      }
    }
  };

  const handleReserveCard = async () => {
    setLoading(true);
    track(TRACKING_EVENTS.CARD_WAITLIST_STARTED, {
      user_id: user?.userId,
      email: user?.email,
    });

    try {
      const access = await resolveCountryAccess('card', 'reserve_card_button');

      // Country unknown or not served yet — let the user confirm where they are.
      if (!access?.isAvailable) {
        router.push(path.CARD_COUNTRY_SELECTION);
        return;
      }

      // The waitlist entry is keyed by email, so collect one first if missing.
      if (user && !user.email) {
        setDetectedCountryInfo({
          countryCode: access.countryCode,
          countryName: access.countryName,
        });
        setShowEmailModal(true);
        return;
      }

      await handleAddToWaitlist(access.countryCode);
    } catch (error) {
      console.error('Error checking country availability:', error);
      router.push(path.CARD_COUNTRY_SELECTION);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <NotificationEmailModalDialog
        open={showEmailModal}
        onOpenChange={open => {
          setShowEmailModal(open);
        }}
        onSuccess={async () => {
          setShowEmailModal(false);

          // Add user to waitlist
          if (detectedCountryInfo) {
            await handleAddToWaitlist(detectedCountryInfo.countryCode);
          }
        }}
      />
      <Button
        variant="brand"
        className="h-12 rounded-xl px-8"
        onPress={handleReserveCard}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#000" />
        ) : (
          <Text className="text-base font-bold">Reserve your card</Text>
        )}
      </Button>
    </>
  );
};

export default ReserveCardButton;
