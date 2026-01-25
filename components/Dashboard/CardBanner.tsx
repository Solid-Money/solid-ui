import { useMemo } from 'react';
import { View } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { path } from '@/constants/path';
import { useCardStatus } from '@/hooks/useCardStatus';
import { useDimension } from '@/hooks/useDimension';
import { getAsset } from '@/lib/assets';
import { CardStatus } from '@/lib/types';

import SwipeableBanner from './SwipeableBanner';

interface BannerContent {
  title: string;
  description: string;
  ctaText: string;
  action: () => void;
  showPromo: boolean;
}

const CardBanner = () => {
  const { isScreenMedium } = useDimension();
  const { data: cardStatus, isLoading } = useCardStatus();

  const bannerContent: BannerContent = useMemo(() => {
    // No card exists - show promotional content
    if (!cardStatus?.status) {
      return {
        title: 'Solid Card is live!',
        description: 'Get your card today.',
        ctaText: 'Get your card',
        action: () => router.push(path.CARD_WAITLIST),
        showPromo: true,
      };
    }

    switch (cardStatus.status) {
      case CardStatus.PENDING:
        return {
          title: 'Your card is on the way!',
          description: 'Your Solid Card has been ordered and is being prepared for delivery.',
          ctaText: 'Track status',
          action: () => router.push(path.CARD_DETAILS),
          showPromo: false,
        };

      case CardStatus.ACTIVE:
        return {
          title: 'Your Solid Card',
          description: 'Manage your card, view transactions, and add funds.',
          ctaText: 'View card',
          action: () => router.push(path.CARD_DETAILS),
          showPromo: false,
        };

      case CardStatus.FROZEN:
        return {
          title: 'Your card is frozen',
          description: 'Your card is temporarily frozen. Tap to manage.',
          ctaText: 'Manage card',
          action: () => router.push(path.CARD_DETAILS),
          showPromo: false,
        };

      case CardStatus.INACTIVE:
        return {
          title: 'Activate your card',
          description: 'Your Solid Card is ready to be activated.',
          ctaText: 'Activate now',
          action: () => router.push(path.CARD_ACTIVATE),
          showPromo: false,
        };

      default:
        return {
          title: 'Solid Card',
          description: 'Manage your Solid Card.',
          ctaText: 'View card',
          action: () => router.push(path.CARD_DETAILS),
          showPromo: false,
        };
    }
  }, [cardStatus?.status]);

  // Don't render while loading to avoid flash of incorrect content
  if (isLoading) {
    return null;
  }

  return (
    <SwipeableBanner onPress={bannerContent.action}>
      <LinearGradient
        colors={['rgba(148, 242, 127, 0.25)', 'rgba(148, 242, 127, 0)']}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.6, y: 1 }}
        style={{
          borderRadius: 20,
          flex: 1,
          width: '100%',
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        <View className="flex-1 flex-row justify-between pl-5 md:px-10">
          <View className="max-w-40 flex-1 items-start justify-between gap-1 py-4 md:max-w-64 md:gap-4 md:py-7">
            <Text className="native:text-lg text-lg font-semibold md:text-3xl">
              {bannerContent.title}
            </Text>
            <Text className="native:text-base native:leading-tight native:font-normal max-w-60 font-medium text-muted-foreground">
              {bannerContent.description}
            </Text>
            <Button
              className="h-11 rounded-xl border-0 bg-button-earning px-6 web:hover:bg-button-earning web:hover:brightness-110 md:h-12"
              onPress={bannerContent.action}
            >
              <Text className="text-base font-bold text-primary">{bannerContent.ctaText}</Text>
            </Button>
          </View>
          <View className="pointer-events-none absolute right-0 top-1/2 -translate-y-1/2">
            <Image
              source={
                isScreenMedium
                  ? getAsset('images/cards-banner.png')
                  : getAsset('images/cards-mobile.png')
              }
              contentFit="contain"
              style={{ width: isScreenMedium ? 250 : 250, height: isScreenMedium ? 250 : 280 }}
            />
          </View>
        </View>
      </LinearGradient>
    </SwipeableBanner>
  );
};

export default CardBanner;
