import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';

import { HERO_EXIT, HeroExit } from '@/components/Card/NewCardDetails/heroMotion';
import { HOME_BANNER_RADIUS } from '@/components/Home/NewHome/homeBannerStyle';
import HomeCashbackPromoBanner from '@/components/Home/NewHome/HomeCashbackPromoBanner';
import BlackFridayPromotion from '@/components/Promotions/BlackFridayPromotion';
import { BLACK_FRIDAY_SLUG, useBlackFridayPromotion } from '@/hooks/useBlackFridayCampaign';
import { useDimension } from '@/hooks/useDimension';
import { usePromotionsBannerPress } from '@/hooks/usePromotionsBanners';
import { isDevFeatureEnabled } from '@/lib/config';
import mmkvStorage from '@/lib/mmvkStorage';

import type { ImageLoadEventData } from 'expo-image';

// The hardcoded Figma card (22024:1057) is 387x98, the same 387pt mobile width
// the wallet card above is drawn at. Banners are sized by ratio rather than by
// that pixel height so they fill the layout column on every screen — a fixed
// height would letterbox the artwork inside a wider desktop column instead of
// growing with it, which is how the neighbouring sections behave too (see
// GET_CARD_PANEL_ASPECT_RATIO in HomeWalletCard).
const BANNER_ASPECT_RATIO = 387 / 98;

// The hardcoded 10% cashback promo is paused; keep the implementation ready for
// a future relaunch. Admin-managed banners are not gated by this — the whole
// point of them is that the dashboard controls what runs, in production too.
const isCashbackPromoEnabled = false;
const BLACK_FRIDAY_DISMISSAL = 'black-friday-2026-dismissed';

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
 * The Black Friday banner sits above the tier trial. Other promotions keep
 * their slot below it and follow the order from the admin dashboard.
 */
const HomePromoBanners = ({ children }: { children: React.ReactNode }) => {
  const { isScreenMedium } = useDimension();
  const { banners, promotion } = useBlackFridayPromotion();
  const getBannerPress = usePromotionsBannerPress();
  const [blackFridayDismissed, setBlackFridayDismissed] = useState(
    () => mmkvStorage('home-promotions').getItem(BLACK_FRIDAY_DISMISSAL) === 'true',
  );
  const visiblePromotion = blackFridayDismissed ? undefined : promotion;
  const otherBanners = banners.filter(banner => banner.slug !== BLACK_FRIDAY_SLUG);
  const showCashbackFallback = isCashbackPromoEnabled && isDevFeatureEnabled;

  return (
    <>
      {visiblePromotion && (
        <PromoSlot>
          <BlackFridayPromotion
            promotion={visiblePromotion}
            onDismiss={() => {
              setBlackFridayDismissed(true);
              mmkvStorage('home-promotions').setItem(BLACK_FRIDAY_DISMISSAL, 'true');
            }}
          />
        </PromoSlot>
      )}
      {children}
      {otherBanners.length > 0 ? (
        <PromoSlot>
          <View style={styles.stack}>
            {otherBanners.map((banner, index) => {
              const uri =
                !isScreenMedium && banner.mobileImageURL ? banner.mobileImageURL : banner.imageURL;

              // Reset the artwork's ratio when crossing the mobile/desktop breakpoint.
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
      ) : (
        showCashbackFallback &&
        !visiblePromotion && (
          <PromoSlot>
            <HomeCashbackPromoBanner />
          </PromoSlot>
        )
      )}
    </>
  );
};

const styles = StyleSheet.create({
  stack: {
    gap: 12,
  },
  card: {
    borderRadius: HOME_BANNER_RADIUS,
    overflow: 'hidden',
    width: '100%',
  },
  image: {
    height: '100%',
    width: '100%',
  },
});

export default HomePromoBanners;
