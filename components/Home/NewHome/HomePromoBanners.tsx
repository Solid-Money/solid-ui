import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';

import { HERO_EXIT, HeroExit } from '@/components/Card/NewCardDetails/heroMotion';
import HomeCashbackPromoBanner from '@/components/Home/NewHome/HomeCashbackPromoBanner';
import { useDimension } from '@/hooks/useDimension';
import { usePromotionsBannerPress, usePromotionsBanners } from '@/hooks/usePromotionsBanners';
import { isDevFeatureEnabled } from '@/lib/config';

import type { PromotionsBannerItem } from '@/lib/types';
import type { ImageLoadEventData } from 'expo-image';

// The hardcoded Figma card (22024:1057) is 387x98, the same 387pt mobile width
// the wallet card above is drawn at. Banners are sized by ratio rather than by
// that pixel height so they fill the layout column on every screen — a fixed
// height would letterbox the artwork inside a wider desktop column instead of
// growing with it, which is how the neighbouring sections behave too (see
// GET_CARD_PANEL_ASPECT_RATIO in HomeWalletCard).
const BANNER_ASPECT_RATIO = 387 / 98;
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
 * One banner, always the full width of the layout column.
 *
 * Height follows the artwork's own ratio, adopted from the loaded image so an
 * admin can upload any shape without it being cropped or letterboxed. Until
 * that arrives the Figma ratio stands in, so a banner drawn to the design
 * reserves exactly the right space and never shifts the page.
 */
const PromoImageBanner = ({ uri, onPress }: { uri: string; onPress: () => void }) => {
  const [aspectRatio, setAspectRatio] = useState(BANNER_ASPECT_RATIO);

  const onLoad = ({ source }: ImageLoadEventData) => {
    if (source.width > 0 && source.height > 0) {
      setAspectRatio(source.width / source.height);
    }
  };

  return (
    <Pressable onPress={onPress} style={[styles.card, { aspectRatio }]}>
      {/* `cover` on a box that already matches the artwork's ratio fills it edge
          to edge; it only ever trims a hair while the ratio is still the
          placeholder, where `contain` would show bars instead. */}
      <Image source={{ uri }} onLoad={onLoad} contentFit="cover" style={styles.image} />
    </Pressable>
  );
};

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
        {banners.map((banner: PromotionsBannerItem, index) => {
          const uri =
            !isScreenMedium && banner.mobileImageURL ? banner.mobileImageURL : banner.imageURL;

          // Keyed by uri as well as position so crossing the mobile/desktop
          // breakpoint starts the new artwork's ratio over rather than holding
          // the previous image's until it loads.
          return (
            <PromoImageBanner
              key={`promo-${banner.slug}-${index}-${uri}`}
              uri={uri}
              onPress={getBannerPress(banner)}
            />
          );
        })}
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
    overflow: 'hidden',
    width: '100%',
  },
  image: {
    height: '100%',
    width: '100%',
  },
});

export default HomePromoBanners;
