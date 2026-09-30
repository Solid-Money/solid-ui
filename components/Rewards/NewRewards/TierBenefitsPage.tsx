import { type ReactNode, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  type SharedValue,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useIsFocused } from '@react-navigation/native';

import {
  CoreCardPerkIcon,
  CoreGlobePerkIcon,
  CoreRocketPerkIcon,
} from '@/assets/images/rewards-tiers/core-tier-icons';
import { Text } from '@/components/ui/text';
import { getAsset } from '@/lib/assets';
import { formatTierCashbackRate } from '@/lib/tierCashback';
import { RewardsTier, type TierBenefits, type TierFees, type TierOffer } from '@/lib/types';

import SubscriptionBrandBadge from './SubscriptionBrandBadge';
import { SUBSCRIPTION_CATEGORIES } from './subscriptionBrands';
import {
  TIER_LABELS,
  TIER_PRESENTATION,
  tierOfferRows,
  tierPresentationContent,
  tierPresentationFees,
} from './tierBenefitsPresentation';
import TierStar from './TierHero/TierStar';

const ART = {
  [RewardsTier.CORE]: { source: 'images/rewards-tiers/v4/card-core.png', width: 350, height: 254 },
  [RewardsTier.PRIME]: {
    source: 'images/rewards-tiers/v4/card-prime.png',
    width: 309,
    height: 213,
  },
  [RewardsTier.ULTRA]: {
    source: 'images/rewards-tiers/v4/card-ultra.png',
    width: 309,
    height: 213,
  },
} as const;
const STATS_GLASS = {
  [RewardsTier.CORE]: { source: 'images/rewards-tiers/v4/stats-core-glass.png', height: 93 },
  [RewardsTier.PRIME]: { source: 'images/rewards-tiers/v4/stats-prime-glass.png', height: 94 },
  [RewardsTier.ULTRA]: { source: 'images/rewards-tiers/v4/stats-ultra-glass.png', height: 95 },
} as const;
// Measured from the Figma stars' transforms relative to each card's PNG bounds.
// The existing transparent animations include padding around their visible shape.
const CARD_STARS = {
  [RewardsTier.CORE]: {
    x: 170.78,
    y: 124.87,
    size: (118.25 * 470) / 412,
    rotation: '-98.4225deg',
    opacity: 0.9,
    still: 'images/rewards-tiers/v4/card-core-still.png',
  },
  [RewardsTier.PRIME]: {
    // Compensate for the exported star's padding and the hero's Prime nudge.
    x: 148.8,
    y: 112.5,
    size: (114.554 * 0.951 * 470) / 394,
    rotation: '-8.4225deg',
    opacity: 1,
    still: 'images/rewards-tiers/v4/card-prime-still.png',
  },
  [RewardsTier.ULTRA]: {
    x: 147.98,
    y: 106.98,
    size: (113.029 * 470) / 388,
    rotation: '-8.4225deg',
    opacity: 1,
    still: 'images/rewards-tiers/v4/card-ultra-still.png',
  },
} as const;
const scaleFor = (width: number) => Math.min(width / 420, 1);
const medium = (s: number) => ({
  fontFamily: 'MonaSans_500Medium',
  fontSize: 16 * s,
  lineHeight: 18 * s,
  color: '#FFFFFF',
});
const regular = (s: number) => ({
  fontFamily: 'MonaSans_400Regular',
  fontSize: 14 * s,
  lineHeight: 16 * s,
  color: 'rgba(255,255,255,0.7)',
});

/** One overscanned backdrop, driven by the same UI-thread position as the pager. */
export function TierBenefitsBackground({
  position,
  width,
  topInset,
}: {
  position: SharedValue<number>;
  width: number;
  topInset: number;
}) {
  const s = scaleFor(width);
  const reduceMotion = useReducedMotion();
  const motion = useAnimatedStyle(() => ({
    transform: [
      {
        translateX: reduceMotion
          ? 104 * s
          : Math.max(0, Math.min(2, -position.value / width)) * 104 * s,
      },
    ],
  }));
  return (
    <View
      pointerEvents="none"
      style={StyleSheet.absoluteFill}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Animated.View
        style={[
          {
            position: 'absolute',
            top: 0,
            left: (width - 420 * s) / 2 - 425 * s,
            width: 952 * s,
            height: 533 * s,
          },
          motion,
        ]}
      >
        <Image
          source={getAsset('images/rewards-tiers/v4/background.png')}
          contentFit="fill"
          transition={0}
          style={{ width: '100%', height: '100%', opacity: 0.4 }}
        />
      </Animated.View>
      <LinearGradient
        colors={['#0F0F1000', '#0F0F10']}
        style={{
          position: 'absolute',
          top: 430 * s,
          left: 0,
          right: 0,
          height: 160 * s + topInset,
        }}
      />
    </View>
  );
}

function TierCardArtwork({
  tier,
  s,
  active,
  position,
  width,
}: {
  tier: RewardsTier;
  s: number;
  active: boolean;
  position: SharedValue<number>;
  width: number;
}) {
  const reduceMotion = useReducedMotion();
  const [starReady, setStarReady] = useState(false);
  const [baseReady, setBaseReady] = useState(false);
  const [posterReady, setPosterReady] = useState(false);
  const focused = useIsFocused();
  const entrance = useSharedValue(reduceMotion ? 1 : 0);
  const artworkReady = posterReady || (baseReady && starReady);
  useEffect(() => {
    if (reduceMotion) {
      entrance.value = 1;
    } else if (!focused) {
      cancelAnimation(entrance);
      entrance.value = 0;
    } else if (artworkReady) {
      entrance.value = withTiming(1, { duration: 560, easing: Easing.out(Easing.cubic) });
    }
    return () => cancelAnimation(entrance);
  }, [artworkReady, entrance, focused, reduceMotion]);
  const index = [RewardsTier.CORE, RewardsTier.PRIME, RewardsTier.ULTRA].indexOf(tier);
  const cardMotion = useAnimatedStyle(() => {
    const distance = reduceMotion ? 0 : Math.max(-1, Math.min(1, -position.value / width - index));
    // A reversible, gentle exit/entrance that follows the finger and the pager's snap.
    const progress = Math.min(1, Math.abs(distance) / 0.9);
    const fade = progress * progress * (3 - 2 * progress);
    return {
      opacity: (1 - fade) * entrance.value,
      transform: [
        { translateY: (Math.abs(distance) * 8 + (1 - entrance.value) * 12) * s },
        { rotate: `${distance * 24 - (1 - entrance.value) * 10}deg` },
        { scale: (0.82 + entrance.value * 0.18) * (1 - fade * 0.18) },
      ],
    };
  });
  const art = ART[tier];
  const star = CARD_STARS[tier];
  const showStill = !starReady || !baseReady || reduceMotion;
  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          top: (325 - art.height / 2) * s,
          left: (width - art.width * s) / 2,
          width: art.width * s,
          height: art.height * s,
        },
        cardMotion,
      ]}
    >
      <Image
        source={getAsset(art.source)}
        accessibilityLabel={`${TIER_LABELS[tier]} Visa card`}
        contentFit="contain"
        transition={0}
        onDisplay={() => setBaseReady(true)}
        style={{ width: art.width * s, height: art.height * s }}
      />
      <View
        pointerEvents="none"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={{
          position: 'absolute',
          left: (star.x - star.size / 2) * s,
          top: (star.y - star.size / 2) * s,
          width: star.size * s,
          height: star.size * s,
          opacity: showStill ? 0 : star.opacity,
          transform: [{ rotate: star.rotation }],
        }}
      >
        <TierStar
          tier={tier}
          size={star.size * s}
          playing={active && focused && !reduceMotion}
          onReady={() => setStarReady(true)}
        />
      </View>
      {showStill && (
        <Image
          source={getAsset(star.still)}
          pointerEvents="none"
          accessible={false}
          contentFit="contain"
          transition={0}
          onDisplay={() => setPosterReady(true)}
          style={StyleSheet.absoluteFill}
        />
      )}
    </Animated.View>
  );
}

function Panel({ title, s, children }: { title?: string; s: number; children: ReactNode }) {
  return (
    <View
      style={{
        marginHorizontal: 17 * s,
        marginTop: 15 * s,
        borderRadius: 20 * s,
        overflow: 'hidden',
        backgroundColor: '#1C1C1C',
      }}
    >
      {title && (
        <>
          <Text style={[medium(s), { color: 'rgba(255,255,255,0.7)', padding: 19 * s }]}>
            {title}
          </Text>
          <View style={styles.divider} />
        </>
      )}
      {children}
    </View>
  );
}

function ValuePill({ value, s, locked = false }: { value: string; s: number; locked?: boolean }) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5 * s,
        paddingHorizontal: 14 * s,
        minHeight: 36 * s,
        borderRadius: 100,
        backgroundColor: locked ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.1)',
      }}
    >
      {locked && (
        <Image
          source={getAsset('images/rewards-tiers/v4/lock.svg')}
          style={{ width: 12 * s, height: 12 * s }}
          contentFit="contain"
        />
      )}
      <Text style={[medium(s), locked && { fontSize: 15 * s, color: 'rgba(255,255,255,0.45)' }]}>
        {value}
      </Text>
    </View>
  );
}

function StatsBand({
  tier,
  s,
  benefits,
}: {
  tier: RewardsTier;
  s: number;
  benefits?: TierBenefits;
}) {
  const content = tierPresentationContent(tier, benefits);
  return (
    <View
      style={{
        marginHorizontal: 17.5 * s,
        height: STATS_GLASS[tier].height * s,
        borderRadius: 24 * s,
        overflow: 'hidden',
      }}
    >
      <Image
        source={getAsset(STATS_GLASS[tier].source)}
        contentFit="fill"
        transition={0}
        pointerEvents="none"
        accessible={false}
        style={StyleSheet.absoluteFill}
      />
      <View style={{ flexDirection: 'row', flex: 1 }}>
        {content.stats.map(stat => {
          const percent = stat.value.endsWith('%');
          const dollar = stat.value.startsWith('$');
          return (
            <View
              key={stat.label}
              style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 6 * s }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', height: 46 * s }}>
                {dollar && (
                  <Text
                    style={{
                      fontFamily: 'MonaSans_400Regular',
                      fontSize: 25 * s,
                      lineHeight: 32 * s,
                      color: content.accent,
                    }}
                  >
                    $
                  </Text>
                )}
                <Text
                  style={{
                    fontFamily: 'MonaSans_300Light',
                    fontSize: 46 * s,
                    lineHeight: 46 * s,
                    letterSpacing: -1.84 * s,
                    color: content.accent,
                  }}
                >
                  {stat.value.replace(/[%$]/g, '')}
                </Text>
                {percent && (
                  <Text
                    style={{
                      fontFamily: 'MonaSans_400Regular',
                      fontSize: 25 * s,
                      lineHeight: 32 * s,
                      color: content.accent,
                    }}
                  >
                    %
                  </Text>
                )}
              </View>
              <Text style={[regular(s), { color: `${content.accent}B3` }]}>{stat.label}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

function PerkIcon({
  tier,
  index,
  s,
  subscriptionRate,
}: {
  tier: RewardsTier;
  index: number;
  s: number;
  subscriptionRate: string | null;
}) {
  if (tier !== RewardsTier.CORE && index === 0)
    return (
      <Image
        source={getAsset('images/rewards-tiers/v4/yield.svg')}
        style={{ width: 50 * s, height: 49.057 * s }}
        contentFit="contain"
      />
    );
  return (
    <View
      style={{
        width: 50 * s,
        height: 49.057 * s,
        borderRadius: 100,
        backgroundColor: 'rgba(255,255,255,0.1)',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {tier === RewardsTier.CORE ? (
        <View style={{ transform: [{ scale: s }] }}>
          {index === 0 ? (
            <CoreCardPerkIcon />
          ) : index === 1 ? (
            <CoreRocketPerkIcon />
          ) : (
            <CoreGlobePerkIcon />
          )}
        </View>
      ) : tier === RewardsTier.ULTRA && index === 2 ? (
        <Image
          source={getAsset('images/rewards-tiers/v4/airline.svg')}
          contentFit="contain"
          transition={0}
          accessible={false}
          style={{
            position: 'absolute',
            left: 11.65 * s,
            top: 11.647 * s,
            width: 26.699 * s,
            height: 26.7015 * s,
          }}
        />
      ) : index === 1 ? (
        <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
          <Text
            style={{
              fontFamily: 'MonaSans_300Light',
              fontSize: 22.62 * s,
              lineHeight: 25 * s,
              color: '#FFFFFF',
            }}
          >
            {subscriptionRate?.replace('%', '')}
          </Text>
          <Text
            style={{
              fontFamily: 'MonaSans_300Light',
              fontSize: 12.675 * s,
              lineHeight: 20 * s,
              color: '#FFFFFF',
            }}
          >
            %
          </Text>
        </View>
      ) : (
        <Image
          source={getAsset('images/rewards-tiers/v4/cap.svg')}
          style={{ width: 26.1729 * s, height: 25.7073 * s }}
          contentFit="contain"
        />
      )}
    </View>
  );
}

function PerksPanel({
  tier,
  s,
  benefits,
}: {
  tier: RewardsTier;
  s: number;
  benefits?: TierBenefits;
}) {
  return (
    <Panel s={s}>
      <View style={{ paddingHorizontal: 19 * s }}>
        {tierPresentationContent(tier, benefits).perks.map((perk, index) => (
          <View key={perk.title}>
            {index > 0 && (
              <View style={[styles.divider, { backgroundColor: 'rgba(255,255,255,0.08)' }]} />
            )}
            <View
              style={{
                minHeight: 89.33 * s,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 13 * s,
                paddingVertical: 12 * s,
              }}
            >
              <PerkIcon
                tier={tier}
                index={index}
                s={s}
                subscriptionRate={tierPresentationContent(tier, benefits).subscriptionRate}
              />
              <View style={{ flex: 1, gap: 3 * s }}>
                <Text style={medium(s)}>{perk.title}</Text>
                <Text style={regular(s)}>{perk.description}</Text>
              </View>
            </View>
          </View>
        ))}
      </View>
    </Panel>
  );
}

function CashbackPanel({
  tier,
  s,
  benefits,
}: {
  tier: RewardsTier;
  s: number;
  benefits?: TierBenefits;
}) {
  const content = tierPresentationContent(tier, benefits);
  const categories = [
    ...SUBSCRIPTION_CATEGORIES.map(category => ({
      ...category,
      rate: content.subscriptionRate,
      asset: null,
    })),
    {
      key: 'rides',
      label: 'Rides',
      rate: content.rideRate,
      brands: [],
      asset: 'images/rewards-tiers/v4/rides.png' as const,
    },
    {
      key: 'airlines',
      label: 'Airlines',
      rate: content.airlineRate,
      brands: [],
      asset: 'images/rewards-tiers/v4/airlines.png' as const,
    },
  ];
  return (
    <Panel title="Cashback" s={s}>
      <View style={{ paddingHorizontal: 19 * s, paddingTop: 9 * s, paddingBottom: 9 * s }}>
        <View
          style={{
            minHeight: 55 * s,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <Text style={medium(s)}>Every purchase</Text>
          <ValuePill value={formatTierCashbackRate(tier)} s={s} />
        </View>
        {categories.map(category => (
          <View
            key={category.key}
            style={{ minHeight: 55 * s, flexDirection: 'row', alignItems: 'center' }}
          >
            <View
              style={{
                flex: 1,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 8 * s,
                opacity: category.rate ? 1 : 0.5,
              }}
            >
              <Text style={medium(s)}>{category.label}</Text>
              {category.asset ? (
                <Image
                  source={getAsset(category.asset)}
                  style={{ width: (category.key === 'rides' ? 86 : 106) * s, height: 26 * s }}
                  contentFit="contain"
                />
              ) : (
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  {category.brands.map((brand, i) => (
                    <SubscriptionBrandBadge
                      key={brand.name}
                      brand={brand}
                      size={22 * s}
                      overlap={i ? -3 * s : undefined}
                      ring
                    />
                  ))}
                </View>
              )}
            </View>
            <ValuePill
              value={category.rate ?? (category.key === 'airlines' ? 'Ultra' : 'Prime')}
              s={s}
              locked={!category.rate}
            />
          </View>
        ))}
      </View>
    </Panel>
  );
}

export function TierBenefitsPage({
  tier,
  active,
  width,
  topInset,
  bottomInset,
  subtitle,
  current,
  position,
  fees,
  benefits,
  offer,
  showUpgradeSpace,
}: {
  tier: RewardsTier;
  active: boolean;
  width: number;
  topInset: number;
  bottomInset: number;
  subtitle: ReactNode;
  current: boolean;
  position: SharedValue<number>;
  fees?: TierFees;
  benefits?: TierBenefits;
  offer?: TierOffer;
  showUpgradeSpace: boolean;
}) {
  const s = scaleFor(width);
  const table = tierPresentationFees(tier, fees);
  const offers = tierOfferRows(offer);
  const focused = useIsFocused();
  const reduceMotion = useReducedMotion();
  const entrance = useSharedValue(reduceMotion ? 1 : 0);

  useEffect(() => {
    entrance.value = reduceMotion
      ? 1
      : focused
        ? withTiming(1, { duration: 520, easing: Easing.out(Easing.cubic) })
        : 0;
    return () => cancelAnimation(entrance);
  }, [entrance, focused, reduceMotion]);

  const index = [RewardsTier.CORE, RewardsTier.PRIME, RewardsTier.ULTRA].indexOf(tier);
  const contentMotion = useAnimatedStyle(() => {
    const distance = reduceMotion ? 0 : Math.min(1, Math.abs(-position.value / width - index));
    const fade = distance * distance * (3 - 2 * distance);
    return {
      opacity: entrance.value * (1 - fade),
      transform: [{ translateY: ((1 - entrance.value) * 28 + fade * 28) * s }],
    };
  });
  return (
    <View
      pointerEvents={active ? 'auto' : 'none'}
      accessibilityElementsHidden={!active}
      importantForAccessibility={active ? 'auto' : 'no-hide-descendants'}
      aria-hidden={!active}
      style={{ width, paddingBottom: bottomInset + (showUpgradeSpace ? 150 : 48) * s }}
    >
      <View style={{ height: topInset + 463 * s }}>
        <Text
          accessibilityRole="header"
          style={{
            position: 'absolute',
            top: topInset + 102 * s,
            left: 0,
            right: 0,
            fontFamily: 'MonaSans_400Regular',
            fontSize: 30 * s,
            lineHeight: 32.4 * s,
            letterSpacing: -0.6 * s,
            color: '#FFFFFF',
            textAlign: 'center',
          }}
        >
          {TIER_PRESENTATION[tier].headline}
        </Text>
        <View
          style={{
            position: 'absolute',
            top: topInset + 174 * s,
            left: 0,
            right: 0,
            alignItems: 'center',
          }}
        >
          {current ? (
            <View
              style={{
                borderRadius: 100,
                backgroundColor: 'rgba(148,242,127,0.12)',
                paddingHorizontal: 12 * s,
                paddingVertical: 6 * s,
              }}
            >
              <Text style={[regular(s), { fontFamily: 'MonaSans_500Medium', color: '#94F27F' }]}>
                Your current tier
              </Text>
            </View>
          ) : (
            subtitle
          )}
        </View>
        <View
          pointerEvents="none"
          style={{ position: 'absolute', top: topInset, left: 0, right: 0, bottom: 0 }}
        >
          <TierCardArtwork tier={tier} s={s} active={active} position={position} width={width} />
        </View>
      </View>
      <Animated.View testID={`tier-benefits-content-${tier}`} style={contentMotion}>
        <StatsBand tier={tier} s={s} benefits={benefits} />
        <PerksPanel tier={tier} s={s} benefits={benefits} />
        <CashbackPanel tier={tier} s={s} benefits={benefits} />
        <Panel title="Fees & Caps" s={s}>
          <View style={{ paddingHorizontal: 19 * s, paddingVertical: 8 * s }}>
            {table.lines.map(line => (
              <View
                key={line.key}
                style={{
                  minHeight: 52 * s,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 10 * s,
                }}
              >
                <Text
                  style={[
                    medium(s),
                    {
                      flex: 1,
                      fontFamily:
                        line.key === 'virtual_card' ? 'MonaSans_500Medium' : 'MonaSans_600SemiBold',
                    },
                  ]}
                >
                  {line.label}
                </Text>
                <ValuePill value={line.value} s={s} />
              </View>
            ))}
            <View
              style={{
                minHeight: 52 * s,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 10 * s,
              }}
            >
              <Text style={[medium(s), { fontFamily: 'MonaSans_600SemiBold' }]}>Cashback cap</Text>
              <Text style={[medium(s), { textAlign: 'right', flexShrink: 1 }]}>
                {table.cashbackCap}
              </Text>
            </View>
          </View>
        </Panel>
        {tier !== RewardsTier.CORE && offers.length > 0 && (
          <Panel title={`Get ${TIER_LABELS[tier]}`} s={s}>
            <View style={{ paddingHorizontal: 20 * s, paddingTop: 4 * s, paddingBottom: 8 * s }}>
              {offers.map(row => (
                <View
                  key={row.label}
                  style={{
                    minHeight: 52 * s,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 10 * s,
                  }}
                >
                  <Text style={[medium(s), { fontFamily: 'MonaSans_400Regular' }]}>
                    {row.label}
                  </Text>
                  <ValuePill value={row.value} s={s} />
                </View>
              ))}
            </View>
          </Panel>
        )}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  divider: { height: 1, backgroundColor: 'rgba(255,255,255,0.1)' },
});
