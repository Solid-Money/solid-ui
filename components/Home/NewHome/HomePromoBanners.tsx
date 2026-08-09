import { Pressable, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';

import HomeCashbackPromoBanner from '@/components/Home/NewHome/HomeCashbackPromoBanner';
import Skeleton from '@/components/ui/skeleton';
import { useDimension } from '@/hooks/useDimension';
import { usePromotionsBannerPress, usePromotionsBanners } from '@/hooks/usePromotionsBanners';

import type { PromotionsBannerItem } from '@/lib/types';

// Matches the hardcoded Figma card (22024:1057) so swapping an admin banner in
// for the fallback never moves the rest of the screen.
const BANNER_HEIGHT = 98;
const BANNER_RADIUS = 23;

/**
 * The promo slot on the redesigned home screen.
 *
 * Banners come from the admin dashboard, targeted by platform, app version and
 * page, so a campaign like "10% Cashback for 7 Days!" can be swapped without
 * shipping a build. `HomeCashbackPromoBanner` — the same card hardcoded from
 * Figma — stays as the fallback for when no banner targets this build, which is
 * what production shows until a banner is created.
 */
const HomePromoBanners = () => {
  const { isScreenMedium } = useDimension();
  const { banners, isLoading } = usePromotionsBanners();
  const getBannerPress = usePromotionsBannerPress();

  // A skeleton rather than the fallback while the list is in flight: rendering
  // the hardcoded card first would visibly swap itself out on a cold cache.
  if (isLoading) {
    return <Skeleton className="w-full" style={styles.skeleton} />;
  }

  if (!banners.length) {
    return <HomeCashbackPromoBanner />;
  }

  return (
    <View style={styles.stack}>
      {banners.map((banner: PromotionsBannerItem, index) => (
        <Pressable
          key={`promo-${banner.slug}-${index}`}
          onPress={getBannerPress(banner)}
          style={styles.card}
        >
          <Image
            source={{
              uri:
                !isScreenMedium && banner.mobileImageURL ? banner.mobileImageURL : banner.imageURL,
            }}
            contentFit="contain"
            style={styles.image}
          />
        </Pressable>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  stack: {
    gap: 12,
  },
  card: {
    borderRadius: BANNER_RADIUS,
    height: BANNER_HEIGHT,
    overflow: 'hidden',
    width: '100%',
  },
  image: {
    height: '100%',
    width: '100%',
  },
  skeleton: {
    borderRadius: BANNER_RADIUS,
    height: BANNER_HEIGHT,
  },
});

export default HomePromoBanners;
