import { Pressable, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';

import { HERO_EXIT, HeroExit } from '@/components/Card/NewCardDetails/heroMotion';
import HomeCashbackPromoBanner from '@/components/Home/NewHome/HomeCashbackPromoBanner';
import { useDimension } from '@/hooks/useDimension';
import { usePromotionsBannerPress, usePromotionsBanners } from '@/hooks/usePromotionsBanners';
import { isDevFeatureEnabled } from '@/lib/config';

import type { PromotionsBannerItem } from '@/lib/types';

// Matches the hardcoded Figma card (22024:1057) so an admin banner and the
// fallback occupy the same space.
const BANNER_HEIGHT = 98;
const BANNER_RADIUS = 23;

// The hardcoded 10% cashback promo is paused; keep the implementation ready for
// a future relaunch. Admin-managed banners are not gated by this — the whole
// point of them is that the dashboard controls what runs, in production too.
const isCashbackPromoEnabled = false;

/**
 * Wraps whatever fills the promo slot. Padding stays on a regular View because
 * Animated.View does not consistently resolve NativeWind padding on web, and
 * HeroExit stays outside it so its native and web motion behaviour is unchanged.
 */
const PromoSlot = ({ children }: { children: React.ReactNode }) => (
  <HeroExit spec={HERO_EXIT.belowCard}>
    <View className="px-4">{children}</View>
  </HeroExit>
);

/**
 * The promo slot on the redesigned home screen.
 *
 * Banners come from the admin dashboard, targeted by platform, app version and
 * page, so a campaign like "10% Cashback for 7 Days!" can be swapped without
 * shipping a build. `HomeCashbackPromoBanner` — that same card hardcoded from
 * Figma — is the fallback for when no banner targets this build, and stays
 * behind its pause flag.
 *
 * Renders nothing at all rather than an empty wrapper when there is nothing to
 * show, which is the common case while the promo is paused: an empty View would
 * still take a slot in the parent's flex gap.
 */
const HomePromoBanners = () => {
  const { isScreenMedium } = useDimension();
  const { banners } = usePromotionsBanners();
  const getBannerPress = usePromotionsBannerPress();

  if (!banners.length) {
    return isCashbackPromoEnabled && isDevFeatureEnabled ? (
      <PromoSlot>
        <HomeCashbackPromoBanner />
      </PromoSlot>
    ) : null;
  }

  return (
    <PromoSlot>
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
                  !isScreenMedium && banner.mobileImageURL
                    ? banner.mobileImageURL
                    : banner.imageURL,
              }}
              contentFit="contain"
              style={styles.image}
            />
          </Pressable>
        ))}
      </View>
    </PromoSlot>
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
});

export default HomePromoBanners;
