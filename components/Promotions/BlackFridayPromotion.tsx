import { useState } from 'react';
import { router } from 'expo-router';

import { usePromotionsBannerPress } from '@/hooks/usePromotionsBanners';

import BlackFridayBanner from './BlackFridayBanner';
import BlackFridayDrawer from './BlackFridayDrawer';

import type { BlackFridayPromotionData } from '@/hooks/useBlackFridayCampaign';

export default function BlackFridayPromotion({
  promotion: { banner, prime, ultra },
  onDismiss,
}: {
  promotion: BlackFridayPromotionData;
  onDismiss?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const getBannerPress = usePromotionsBannerPress();

  return (
    <>
      <BlackFridayBanner onPress={() => setOpen(true)} onDismiss={onDismiss} />
      <BlackFridayDrawer
        prime={prime}
        ultra={ultra}
        isOpen={open}
        onOpenChange={setOpen}
        onSeeTiers={
          banner?.link?.trim()
            ? getBannerPress(banner)
            : () => router.push({ pathname: '/rewards/benefits', params: { tier: 'prime' } })
        }
      />
    </>
  );
}
