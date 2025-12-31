import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Link, router } from 'expo-router';
import { useMemo } from 'react';
import { View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { path } from '@/constants/path';
import { useCardStatus } from '@/hooks/useCardStatus';
import { useDimension } from '@/hooks/useDimension';
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
        description: 'Get your card today and receive $50 bonus.',
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
          height: '100%',
          width: '100%',
          overflow: 'hidden',
        }}
      >
        <View className="flex-1 flex-row justify-between pl-5 md:px-10">
          <View className="max-w-40 md:max-w-64 justify-between items-start gap-1 md:gap-4 py-4 md:py-7">
            <Text className="text-lg md:text-3xl font-semibold native:text-lg">
              {bannerContent.title}
            </Text>
            <Text className="text-muted-foreground font-semibold native:text-base">
              {bannerContent.description}
              {bannerContent.showPromo && (
                <>
                  {' '}
                  <Link
                    target="_blank"
                    href={
                      'https://support.solid.xyz/en/articles/13213137-solid-card-launch-campaign-terms-conditions'
                    }
                    className="underline"
                  >
                    Read more
                  </Link>
                  {' >'}
                </>
              )}
            </Text>
            <Button
              className="rounded-xl h-11 md:h-12 px-6 border-0 bg-button-earning web:hover:bg-button-earning web:hover:brightness-110"
              onPress={bannerContent.action}
            >
              <Text className="text-base text-primary font-bold">{bannerContent.ctaText}</Text>
            </Button>
          </View>
          <View className="-mt-14 -ml-4 md:-mt-4 pointer-events-none">
            <Image
              source={
                isScreenMedium
                  ? require('@/assets/images/cards-banner.png')
                  : require('@/assets/images/cards-mobile.png')
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
