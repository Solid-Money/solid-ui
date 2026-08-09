import { useEffect, useRef } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowLeft } from 'lucide-react-native';

import { REGION_BENEFITS, RegionBenefit } from '@/components/RegionUnavailable/benefits';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { TRACKING_EVENTS } from '@/constants/tracking-events';
import { track } from '@/lib/analytics';
import { logRegionInterest } from '@/lib/api';
import { getAsset } from '@/lib/assets';
import { GatedProduct, RegionInterestPayload } from '@/lib/types';

/** Where the blocked user is, for the lead record and analytics. */
export interface RegionUnavailableGeo {
  countryCode: string;
  countryName?: string;
  state?: string;
  city?: string;
  detectionSource?: RegionInterestPayload['detectionSource'];
}

export interface RegionUnavailableViewProps {
  product: GatedProduct;
  /** Where the user is — logged as a lead so we can activate them later. */
  geo: RegionUnavailableGeo;
  /** Entry point that surfaced the pop-up, for funnel attribution. */
  source: string;
  onBack: () => void;
  /** "Continue to the app" — drop the user back into what still works. */
  onContinue: () => void;
  /**
   * Points below the safe-area inset for the back button and hero, so the
   * content lands at y=59 on the Figma frame. Defaults to a full-screen host;
   * pass 7 from inside the deposit dialog, which already adds its own 8pt
   * overlay inset.
   */
  topOffset?: number;
  /**
   * "Change country" — only wired up where a country selection screen exists
   * (the card). Omitted for products detected purely from IP.
   */
  onChangeCountry?: () => void;
}

const BACKGROUND = '#111111';
const HAIRLINE = 'rgba(255,255,255,0.1)';
// Row heights and badge offsets are the Figma grid's own (node 925:1375,
// a 555pt card split by hairlines at y=194 and y=373).
const ROW_HEIGHTS = [194, 179, 182];
const ROW_PADDING_TOP = [23, 23, 27];
const BADGE_WIDTH = 50;
const BADGE_HEIGHT = 49;
const CTA_HEIGHT = 50;
const CTA_PADDING_TOP = 34;
const CTA_PADDING_BOTTOM = 39;
const CHANGE_COUNTRY_HEIGHT = 44;
// Extra height the pinned bars fade over, so scrolled content dims out instead
// of getting a hard clip — same treatment as CardWaitingModal.
const FADE_EXTENT = 120;

/**
 * Copy per product, straight from Figma nodes 925:1364 and 925:1518.
 *
 * `gridGap` is the design's subtitle-to-grid distance, which differs because
 * the card's subtitle is one line and the virtual account's is two.
 */
const COPY: Record<GatedProduct, { title: string; subtitle: string; gridGap: number }> = {
  card: {
    title: 'No card in your region yet\neverything else is live',
    subtitle: 'See what you can still do',
    gridGap: 74,
  },
  virtual_account: {
    title: 'No USD virtual accounts in your region yet',
    subtitle: 'Everything else is live.\nSee what you can still do',
    gridGap: 54,
  },
};

/** Tilted Solid card with its green glow already faded into #111. */
const CardHero = () => (
  <Image
    source={getAsset('images/card-waiting-hero.png')}
    style={styles.cardHero}
    contentFit="contain"
  />
);

/**
 * USD hero — a green radial glow, a black disc and the US flag, concentric.
 *
 * Sizes are percentages of the 419pt Figma frame so the stack scales with the
 * device instead of clipping on narrow screens. The disc is drawn rather than
 * exported: Figma bakes the frame background into a PNG of a node that has no
 * clip of its own, which shows up as a lighter square against #111. The flag
 * is exported (it's a real image) and round-clipped for the same reason —
 * oversized inside its clip so the flag's own circle meets the edge exactly.
 */
const VirtualAccountHero = () => (
  <View className="w-full items-center justify-center" style={styles.vaHero}>
    <Image
      source={getAsset('images/region-unavailable-glow.svg')}
      style={styles.vaHeroGlow}
      contentFit="contain"
    />
    <View style={styles.vaHeroDisc} />
    <View style={styles.vaHeroFlagClip}>
      <Image
        source={getAsset('images/region-unavailable-va-flag.png')}
        style={styles.vaHeroFlagImage}
        contentFit="contain"
      />
    </View>
  </View>
);

const BenefitCell = ({
  benefit,
  paddingTop,
  showRightBorder,
}: {
  benefit: RegionBenefit;
  paddingTop: number;
  showRightBorder: boolean;
}) => (
  <View
    className="flex-1 items-center px-2"
    style={{
      paddingTop,
      borderRightWidth: showRightBorder ? 1 : 0,
      borderRightColor: HAIRLINE,
    }}
  >
    <View className="items-center justify-center rounded-full bg-white/10" style={styles.badge}>
      <Image
        source={benefit.icon}
        style={{ width: benefit.iconWidth, height: benefit.iconHeight }}
        contentFit="contain"
      />
    </View>
    <Text
      className="mt-[9px] text-center text-[16px] font-medium text-white"
      style={styles.benefitTitle}
    >
      {benefit.title}
    </Text>
    <Text
      className="mt-[5px] text-center text-[14px] font-medium text-white/70"
      style={styles.benefitDescription}
    >
      {benefit.description}
    </Text>
  </View>
);

const BenefitsGrid = () => (
  <View className="overflow-hidden bg-[#1C1C1C]" style={styles.benefitsCard}>
    {ROW_HEIGHTS.map((height, rowIndex) => (
      <View
        key={height}
        className="flex-row"
        style={{
          height,
          borderBottomWidth: rowIndex < ROW_HEIGHTS.length - 1 ? 1 : 0,
          borderBottomColor: HAIRLINE,
        }}
      >
        <BenefitCell
          benefit={REGION_BENEFITS[rowIndex * 2]}
          paddingTop={ROW_PADDING_TOP[rowIndex]}
          showRightBorder
        />
        <BenefitCell
          benefit={REGION_BENEFITS[rowIndex * 2 + 1]}
          paddingTop={ROW_PADDING_TOP[rowIndex]}
          showRightBorder={false}
        />
      </View>
    ))}
  </View>
);

/**
 * "Not available in your region yet" pop-up (Figma nodes 925:1364 for the card
 * and 925:1518 for USD virtual accounts).
 *
 * Rather than leaving the user at a dead end, it names what Solid still does
 * for them and hands them back to the app. Showing it also records a lead —
 * user, product, country and state — so the region can be activated the day it
 * opens (`POST /accounts/v1/region-interest`).
 */
export const RegionUnavailableView = ({
  product,
  geo,
  source,
  onBack,
  onContinue,
  onChangeCountry,
  topOffset = 15,
}: RegionUnavailableViewProps) => {
  const insets = useSafeAreaInsets();
  // On Android (edge-to-edge) the safe-area bottom inset can come back smaller
  // than the system nav bar inside a dialog portal, leaving the pinned CTA too
  // close to the edge. Floor it; iOS keeps its correct home-indicator inset.
  const bottomInset = Math.max(insets.bottom, Platform.OS === 'android' ? 24 : 0);
  const { title, subtitle, gridGap } = COPY[product];
  const contentTop = insets.top + topOffset;
  const logged = useRef(false);

  const ctaBlockHeight =
    CTA_PADDING_TOP +
    CTA_HEIGHT +
    (onChangeCountry ? CHANGE_COUNTRY_HEIGHT : 0) +
    bottomInset +
    CTA_PADDING_BOTTOM;

  // Capture the lead once per mount. Deliberately fire-and-forget: the pop-up
  // must render the same whether or not the write lands.
  useEffect(() => {
    if (logged.current) return;
    logged.current = true;

    track(TRACKING_EVENTS.REGION_UNAVAILABLE_SHOWN, {
      product,
      source,
      countryCode: geo.countryCode,
      countryName: geo.countryName,
      state: geo.state,
      detectionSource: geo.detectionSource,
    });

    void logRegionInterest({
      product,
      countryCode: geo.countryCode.toUpperCase(),
      countryName: geo.countryName,
      state: geo.state,
      city: geo.city,
      detectionSource: geo.detectionSource,
      source,
    });
  }, [product, source, geo]);

  const handleContinue = () => {
    track(TRACKING_EVENTS.REGION_UNAVAILABLE_CONTINUE_PRESSED, {
      product,
      source,
      countryCode: geo.countryCode,
    });
    onContinue();
  };

  const handleChangeCountry = () => {
    track(TRACKING_EVENTS.REGION_UNAVAILABLE_CHANGE_COUNTRY_PRESSED, {
      product,
      source,
      countryCode: geo.countryCode,
    });
    onChangeCountry?.();
  };

  return (
    <View className="flex-1 bg-[#111]">
      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          paddingTop: contentTop,
          paddingBottom: ctaBlockHeight + 24,
        }}
        showsVerticalScrollIndicator={false}
      >
        {product === 'card' ? <CardHero /> : <VirtualAccountHero />}

        {/* The Figma text boxes are 345/315 wide on a 419 frame; the 18pt
            gutter keeps them off the edge on narrower devices. */}
        <View className="items-center px-[18px]">
          <Text
            className="mt-[27px] text-center text-[30px] font-medium -tracking-[1px] text-white"
            style={styles.title}
          >
            {title}
          </Text>
          <Text className="mt-[15px] text-center text-[16px] text-white/70" style={styles.subtitle}>
            {subtitle}
          </Text>
        </View>

        <View className="px-[18px]" style={{ marginTop: gridGap }}>
          <BenefitsGrid />
        </View>
      </ScrollView>

      {/* Back arrow — overlaid on the scrollable content so it fades in rather
          than clipping it */}
      <LinearGradient
        colors={[BACKGROUND, `${BACKGROUND}00`]}
        pointerEvents="box-none"
        style={[styles.topFade, { height: contentTop + 44 + FADE_EXTENT }]}
      >
        <View style={{ paddingTop: contentTop }} className="px-[18px]">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Go back"
            onPress={onBack}
            className="h-11 w-11 items-center justify-center rounded-full bg-white/10 web:hover:bg-white/15"
          >
            <ArrowLeft color="#ffffff" size={22} />
          </Pressable>
        </View>
      </LinearGradient>

      {/* Pinned CTA — same overlay treatment on the bottom edge */}
      <LinearGradient
        colors={[`${BACKGROUND}00`, BACKGROUND, BACKGROUND]}
        locations={[0, FADE_EXTENT / (ctaBlockHeight + FADE_EXTENT), 1]}
        pointerEvents="box-none"
        style={[styles.bottomFade, { height: ctaBlockHeight + FADE_EXTENT }]}
      >
        <View
          style={{
            paddingHorizontal: 18,
            paddingTop: CTA_PADDING_TOP,
            paddingBottom: bottomInset + CTA_PADDING_BOTTOM,
          }}
        >
          {onChangeCountry ? (
            <Pressable
              onPress={handleChangeCountry}
              className="mb-[10px] h-[34px] items-center justify-center web:hover:opacity-70"
            >
              <Text className="text-base font-bold text-white">Change country</Text>
            </Pressable>
          ) : null}

          <Button
            variant="brand"
            className="h-[50px] w-full rounded-full border-0 active:opacity-90"
            onPress={handleContinue}
          >
            <Text className="text-[16px] font-semibold text-black">Continue to the app</Text>
          </Button>
        </View>
      </LinearGradient>
    </View>
  );
};

const styles = StyleSheet.create({
  cardHero: { width: '100%', aspectRatio: 402 / 300 },
  // 373 / 419 — the glow's own square, so nothing clips on narrow screens.
  vaHero: { width: '100%', aspectRatio: 419 / 373 },
  vaHeroGlow: { position: 'absolute', width: '89.02%', aspectRatio: 1 },
  // 188 / 419, with the glow's rim picked up as a hairline border.
  vaHeroDisc: {
    position: 'absolute',
    width: '44.87%',
    aspectRatio: 1,
    borderRadius: 9999,
    backgroundColor: '#000000',
    borderWidth: 1,
    borderColor: 'rgba(148,242,127,0.35)',
  },
  // 97 / 419 — the flag's visible circle.
  vaHeroFlagClip: {
    width: '23.15%',
    aspectRatio: 1,
    borderRadius: 9999,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  // 117 / 97 — the export's own padding, scaled back out and clipped away.
  vaHeroFlagImage: { width: '120.62%', aspectRatio: 1 },
  title: { lineHeight: 30, maxWidth: 345 },
  subtitle: { lineHeight: 20, maxWidth: 315 },
  benefitsCard: { borderRadius: 23 },
  badge: { width: BADGE_WIDTH, height: BADGE_HEIGHT },
  benefitTitle: { lineHeight: 17.6 },
  benefitDescription: { lineHeight: 15.4 },
  topFade: { position: 'absolute', top: 0, left: 0, right: 0 },
  bottomFade: { position: 'absolute', bottom: 0, left: 0, right: 0, justifyContent: 'flex-end' },
});

export default RegionUnavailableView;
