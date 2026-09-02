import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';

import {
  CoreCardPerkIcon,
  CoreGlobePerkIcon,
  CoreRocketPerkIcon,
  CoreTierSparkle,
} from '@/assets/images/rewards-tiers/core-tier-icons';
import { SIDEBAR_BODY_WIDTH, useIsSidebarShell, usePageWidth } from '@/components/Navbar/Sidebar';
import PageLayout from '@/components/PageLayout';
import { BackButton } from '@/components/ui/back-button';
import { Text } from '@/components/ui/text';
import { path } from '@/constants/path';
import { useRewardsUserData } from '@/hooks/useRewards';
import { useSavingsFundFlow } from '@/hooks/useSavingsFundFlow';
import { formatTierCashbackRate } from '@/lib/tierCashback';
import { RewardsTier } from '@/lib/types';
import { useSwapState } from '@/store/swapStore';
import { useDepositStore } from '@/store/useDepositStore';

import SubscriptionBrandBadge from './SubscriptionBrandBadge';
import { SUBSCRIPTION_CATEGORIES } from './subscriptionBrands';
import TierHero from './TierHero';
import TierPointsSheet from './TierPointsSheet';
import TierStatsBand from './TierStatsBand';
import TierSwitcher from './TierSwitcher';
import UpgradeTierSheet from './UpgradeTierSheet';

const TIERS = [RewardsTier.CORE, RewardsTier.PRIME, RewardsTier.ULTRA];

const TIER_LABELS: Record<RewardsTier, string> = {
  [RewardsTier.CORE]: 'Core',
  [RewardsTier.PRIME]: 'Prime',
  [RewardsTier.ULTRA]: 'Ultra',
};

const PRIME_TIER_SPARKLE = require('@/assets/images/rewards-tiers/prime-tier-sparkle.png');
const ULTRA_TIER_SPARKLE = require('@/assets/images/rewards-tiers/ultra-tier-sparkle.png');
const TIER_INFO = require('@/assets/images/rewards-tiers/tier-info.png');
const YIELD_BOOST_ICON = require('@/assets/images/rewards-tiers/yield-boost.png');
const CASHBACK_CAP_ICON = require('@/assets/images/rewards-tiers/cashback-cap.png');

interface TierStat {
  label: string;
  value: string;
}

interface TierPerk {
  title: string;
  description: string;
}

const BADGE_SIZE = 22;
// The design steps adjacent badges ~19px apart; the card-colored ring baked
// into every badge keeps the overlapping stack readable.
const BADGE_OVERLAP = -3;
// Rows a tier hasn't unlocked yet keep their logos but sit at 40% — same
// treatment the design gives the row's label and "Prime and up" text.
const LOCKED_OPACITY = 0.4;

interface TierContent {
  headline: string;
  unlockCopy: string;
  stats: TierStat[];
  perks: TierPerk[];
  /**
   * `subscriptionRate` is the cashback this tier earns back on every
   * subscription category, or null when the tier hasn't unlocked them. The
   * categories themselves come from SUBSCRIPTION_CATEGORIES.
   */
  cashback: { everyPurchase: string; subscriptionRate: string | null };
  fees: { cardFees: string; bankDeposit: string; swaps: string; cashbackCap: string };
}

// Every tier's cashback figure on this screen comes from the shared rates table,
// so the comparison here and the "N% Cashback" benefit card on the rewards
// screen can't drift apart.
const TIER_CONTENT: Record<RewardsTier, TierContent> = {
  [RewardsTier.CORE]: {
    headline: 'The Solid Foundation',
    unlockCopy: 'Starting tier',
    stats: [
      { label: 'Cashback', value: formatTierCashbackRate(RewardsTier.CORE) },
      { label: '24/7 Fast support', value: '' },
    ],
    perks: [
      { title: 'Free virtual card', description: 'Issued instantly' },
      { title: 'Set up in minutes', description: 'Under 5 minutes' },
      { title: 'Spend globally', description: 'Card accepted in 180+ countries' },
    ],
    cashback: {
      everyPurchase: formatTierCashbackRate(RewardsTier.CORE),
      subscriptionRate: null,
    },
    fees: {
      cardFees: 'Free',
      bankDeposit: 'Free',
      swaps: 'Free',
      cashbackCap: 'Up to 50$ monthly',
    },
  },
  [RewardsTier.PRIME]: {
    headline: 'Enhanced Daily Rewards',
    unlockCopy: 'Unlocks at 5M points',
    stats: [
      { label: 'Cashback', value: formatTierCashbackRate(RewardsTier.PRIME) },
      { label: 'Yield boost', value: '+2%' },
      { label: 'Back on AI', value: '25%' },
    ],
    perks: [
      { title: 'Yield boost', description: '+2% APY on your savings' },
      {
        title: 'Subscription discounts',
        description: '25% back on AI, streaming, music',
      },
      { title: 'Higher cashback caps', description: 'Up to $100 monthly cap' },
    ],
    cashback: {
      everyPurchase: formatTierCashbackRate(RewardsTier.PRIME),
      subscriptionRate: '25%',
    },
    fees: {
      cardFees: 'Free',
      bankDeposit: 'Free',
      swaps: 'Free',
      cashbackCap: 'Up to 100$ monthly',
    },
  },
  [RewardsTier.ULTRA]: {
    headline: 'Unmatched Spending Power',
    unlockCopy: 'Unlocks at 35M Points',
    stats: [
      { label: 'Cashback', value: formatTierCashbackRate(RewardsTier.ULTRA) },
      { label: 'Yield boost', value: '+3%' },
      { label: 'Back on AI', value: '50%' },
    ],
    perks: [
      { title: 'Yield boost', description: '+3% APY boost on your savings' },
      {
        title: 'Subscription discounts',
        description: '50% back on AI, streaming, music',
      },
      { title: 'Higher cashback caps', description: 'Up to $200 monthly cap' },
    ],
    cashback: {
      everyPurchase: formatTierCashbackRate(RewardsTier.ULTRA),
      subscriptionRate: '50%',
    },
    fees: {
      cardFees: 'Free',
      bankDeposit: 'Free',
      swaps: 'Free',
      cashbackCap: 'Up to 200$ monthly',
    },
  },
};

const CoreDivider = () => <View style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.1)' }} />;

const CORE_MEDIUM_16 = {
  fontFamily: 'MonaSans_500Medium',
  fontSize: 16,
  lineHeight: 18,
} as const;

const CORE_REGULAR_14 = {
  fontFamily: 'MonaSans_400Regular',
  fontSize: 14,
  lineHeight: 16,
} as const;

const CorePerkIcon = ({ index }: { index: number }) => (
  <View className="h-[50px] w-[50px] items-center justify-center rounded-full bg-white/10">
    {index === 0 ? (
      <CoreCardPerkIcon />
    ) : index === 1 ? (
      <CoreRocketPerkIcon />
    ) : (
      <CoreGlobePerkIcon />
    )}
  </View>
);

const CoreSummaryAndPerks = () => {
  const content = TIER_CONTENT[RewardsTier.CORE];

  return (
    <View className="mx-4 mt-[45px]">
      <TierStatsBand stats={content.stats} />

      <View className="-mt-[41px] h-[270px] overflow-hidden rounded-twice bg-[#1C1C1C]">
        {content.perks.map((perk, index) => (
          <View key={perk.title}>
            {index > 0 && <CoreDivider />}
            <View className="h-[90px] flex-row items-center justify-between px-[19px]">
              <View className="flex-1 pr-3">
                <Text className="text-white" style={CORE_MEDIUM_16}>
                  {perk.title}
                </Text>
                <Text className="mt-[2px] text-white/70" style={CORE_REGULAR_14}>
                  {perk.description}
                </Text>
              </View>
              <CorePerkIcon index={index} />
            </View>
          </View>
        ))}
      </View>
    </View>
  );
};

const CoreCashbackCard = () => {
  const { cashback } = TIER_CONTENT[RewardsTier.CORE];

  return (
    <View className="relative mx-4 mt-[14px] h-[298px] overflow-hidden rounded-twice bg-[#1C1C1C]">
      <Text className="absolute left-[19px] top-[19px] text-white/70" style={CORE_MEDIUM_16}>
        Cashback
      </Text>
      <View className="absolute left-0 right-0 top-[57px]">
        <CoreDivider />
      </View>
      <Text className="absolute left-[19px] top-[85px] text-white" style={CORE_MEDIUM_16}>
        Every purchase
      </Text>
      <View className="absolute right-4 top-[76px] h-9 min-w-[51px] items-center justify-center rounded-full bg-white/10 px-3">
        <Text className="text-white" style={CORE_MEDIUM_16}>
          {cashback.everyPurchase}
        </Text>
      </View>
      {SUBSCRIPTION_CATEGORIES.map((category, index) => (
        <View
          key={category.key}
          className="absolute left-[19px] right-4 h-[22px] flex-row items-center"
          style={{ top: [138, 195, 248][index] }}
        >
          <Text className="text-white/40" style={CORE_MEDIUM_16}>
            {category.label}
          </Text>
          <View className="ml-3 flex-1 flex-row items-center" style={{ opacity: LOCKED_OPACITY }}>
            {category.brands.map((brand, brandIndex) => (
              <SubscriptionBrandBadge
                key={brand.name}
                brand={brand}
                size={BADGE_SIZE}
                overlap={brandIndex > 0 ? BADGE_OVERLAP : undefined}
                ring
              />
            ))}
          </View>
          <Text className="text-white/40" style={CORE_MEDIUM_16}>
            Prime and up
          </Text>
        </View>
      ))}
    </View>
  );
};

const CoreFeesCard = () => {
  const { fees } = TIER_CONTENT[RewardsTier.CORE];
  const rows = [
    { label: 'Card fees', value: fees.cardFees, top: 73, emphasize: false },
    { label: 'Bank deposit', value: fees.bankDeposit, top: 125, emphasize: true },
    { label: 'Swaps', value: fees.swaps, top: 177, emphasize: true },
  ];

  return (
    <View className="relative mx-4 mt-[15px] h-[292px] overflow-hidden rounded-twice bg-[#1C1C1C]">
      <Text className="absolute left-[19px] top-[19px] text-white/70" style={CORE_MEDIUM_16}>
        Fees & Caps
      </Text>
      <View className="absolute left-0 right-0 top-[57px]">
        <CoreDivider />
      </View>
      {rows.map(row => (
        <View
          key={row.label}
          className="absolute left-[19px] right-4 h-9 flex-row items-center justify-between"
          style={{ top: row.top }}
        >
          <Text
            className="text-white"
            style={{
              ...CORE_MEDIUM_16,
              fontFamily: row.emphasize ? 'MonaSans_600SemiBold' : 'MonaSans_500Medium',
            }}
          >
            {row.label}
          </Text>
          <View className="h-9 min-w-[58px] items-center justify-center rounded-full bg-white/10 px-3">
            <Text className="text-white" style={CORE_MEDIUM_16}>
              {row.value}
            </Text>
          </View>
        </View>
      ))}
      <View className="absolute left-[19px] right-4 top-[238px] flex-row justify-between">
        <Text
          className="text-white"
          style={{ ...CORE_MEDIUM_16, fontFamily: 'MonaSans_600SemiBold', lineHeight: 22 }}
        >
          Cashback cap
        </Text>
        <Text className="text-right text-white" style={CORE_MEDIUM_16}>
          {fees.cashbackCap}
        </Text>
      </View>
    </View>
  );
};

const PremiumPerkIcon = ({ index }: { index: number }) => {
  if (index === 1) {
    return (
      <View className="h-[50px] w-[50px] items-center justify-center rounded-full bg-white/10">
        <Text className="text-white" style={CORE_MEDIUM_16}>
          25%
        </Text>
      </View>
    );
  }

  return (
    <Image
      source={index === 0 ? YIELD_BOOST_ICON : CASHBACK_CAP_ICON}
      style={{ width: 50, height: 50 }}
      contentFit="contain"
    />
  );
};

const PremiumSummaryAndPerks = ({ tier }: { tier: RewardsTier.PRIME | RewardsTier.ULTRA }) => {
  const content = TIER_CONTENT[tier];
  const discount = tier === RewardsTier.PRIME ? '25%' : '50%';

  return (
    <View className="mx-4 mt-[59px]">
      <TierStatsBand stats={content.stats} />

      <View className="-mt-[42px] h-[270px] overflow-hidden rounded-twice bg-[#1C1C1C]">
        {content.perks.map((perk, index) => (
          <View key={perk.title}>
            {index > 0 && <CoreDivider />}
            <View className="h-[90px] flex-row items-center justify-between px-[19px]">
              <View className="flex-1 pr-3">
                <Text className="text-white" style={CORE_MEDIUM_16}>
                  {perk.title}
                </Text>
                <Text className="mt-[2px] text-white/70" style={CORE_REGULAR_14}>
                  {perk.description}
                </Text>
              </View>
              {index === 1 ? (
                <View className="h-[50px] w-[50px] items-center justify-center rounded-full bg-white/10">
                  <Text className="text-white" style={CORE_MEDIUM_16}>
                    {discount}
                  </Text>
                </View>
              ) : (
                <PremiumPerkIcon index={index} />
              )}
            </View>
          </View>
        ))}
      </View>
    </View>
  );
};

const PremiumCashbackCard = ({ tier }: { tier: RewardsTier.PRIME | RewardsTier.ULTRA }) => {
  const { cashback } = TIER_CONTENT[tier];

  return (
    <View className="relative mx-4 mt-[15px] h-[298px] overflow-hidden rounded-twice bg-[#1C1C1C]">
      <Text className="absolute left-[19px] top-[19px] text-white/70" style={CORE_MEDIUM_16}>
        Cashback
      </Text>
      <View className="absolute left-0 right-0 top-[57px]">
        <CoreDivider />
      </View>
      <Text className="absolute left-[19px] top-[85px] text-white" style={CORE_MEDIUM_16}>
        Every purchase
      </Text>
      <View className="absolute right-4 top-[76px] h-9 min-w-[51px] items-center justify-center rounded-full bg-white/10 px-3">
        <Text className="text-white" style={CORE_MEDIUM_16}>
          {cashback.everyPurchase}
        </Text>
      </View>

      {SUBSCRIPTION_CATEGORIES.map((category, index) => (
        <View
          key={category.key}
          className="absolute left-[19px] right-4 h-9 flex-row items-center"
          style={{ top: [131, 188, 241][index] }}
        >
          <Text className="text-white" style={CORE_MEDIUM_16}>
            {category.label}
          </Text>
          <View className="ml-3 flex-1 flex-row items-center">
            {category.brands.map((brand, brandIndex) => (
              <SubscriptionBrandBadge
                key={brand.name}
                brand={brand}
                size={BADGE_SIZE}
                overlap={brandIndex > 0 ? BADGE_OVERLAP : undefined}
                ring
              />
            ))}
          </View>
          <View className="h-9 min-w-[59px] items-center justify-center rounded-full bg-white/10 px-3">
            <Text className="text-white" style={CORE_MEDIUM_16}>
              {cashback.subscriptionRate}
            </Text>
          </View>
        </View>
      ))}
    </View>
  );
};

const PremiumFeesCard = ({ tier }: { tier: RewardsTier.PRIME | RewardsTier.ULTRA }) => {
  const { fees } = TIER_CONTENT[tier];
  const rows = [
    { label: 'Card fees', value: fees.cardFees, top: 73, emphasize: false },
    { label: 'Bank deposit', value: fees.bankDeposit, top: 125, emphasize: true },
    { label: 'Swaps', value: fees.swaps, top: 177, emphasize: true },
  ];

  return (
    <View className="relative mx-4 mt-[15px] h-[292px] overflow-hidden rounded-twice bg-[#1C1C1C]">
      <Text className="absolute left-[19px] top-[19px] text-white/70" style={CORE_MEDIUM_16}>
        Fees & Caps
      </Text>
      <View className="absolute left-0 right-0 top-[57px]">
        <CoreDivider />
      </View>
      {rows.map(row => (
        <View
          key={row.label}
          className="absolute left-[19px] right-4 h-9 flex-row items-center justify-between"
          style={{ top: row.top }}
        >
          <Text
            className="text-white"
            style={{
              ...CORE_MEDIUM_16,
              fontFamily: row.emphasize ? 'MonaSans_600SemiBold' : 'MonaSans_500Medium',
            }}
          >
            {row.label}
          </Text>
          <View className="h-9 min-w-[58px] items-center justify-center rounded-full bg-white/10 px-3">
            <Text className="text-white" style={CORE_MEDIUM_16}>
              {row.value}
            </Text>
          </View>
        </View>
      ))}
      <View className="absolute left-[19px] right-4 top-[238px] flex-row justify-between">
        <Text
          className="text-white"
          style={{ ...CORE_MEDIUM_16, fontFamily: 'MonaSans_600SemiBold', lineHeight: 22 }}
        >
          Cashback cap
        </Text>
        <Text className="text-right text-white" style={CORE_MEDIUM_16}>
          {fees.cashbackCap}
        </Text>
      </View>
    </View>
  );
};

/**
 * Redesigned "Explore tiers" screen (Apple "glass" style companion to
 * RewardsScreenNew). Reachable from the "Explore tiers" button on the
 * redesigned rewards home screen. Shown only on qa/preview mobile builds via
 * the dispatcher in rewards/benefits.tsx — desktop keeps the legacy
 * CompareTiersTable-based screen.
 */
const HEADER_ROW_HEIGHT = 56;
/** Figma leaves 20px above the tier tabs. */
const HEADER_TOP_SPACING = 20;
const DESKTOP_HERO_TOP_REDUCTION = 30;
const SLIDE_DURATION = 260;
const SLIDE_EASING = Easing.out(Easing.cubic);
const PREMIUM_FOOTER_SLIDE_DURATION = 360;
const PREMIUM_FOOTER_SLIDE_EASING = Easing.bezier(0.22, 1, 0.36, 1);
const SWIPE_DISTANCE_THRESHOLD = 50;
const SWIPE_VELOCITY_THRESHOLD = 400;
// Dampens the drag past the first/last tier so it feels like it's resisting.
const RUBBER_BAND_FACTOR = 0.3;
// bg-background (--background), used as the solid end of the top/bottom fades.
const BACKGROUND = '#0F0F10';
const PAGE_BOTTOM_SPACING = 48;
const PREMIUM_FOOTER_FADE_HEIGHT = 82;
const PREMIUM_FOOTER_OVERLAP = 94;
const PREMIUM_FOOTER_BUTTON_TOP = 130;
const PREMIUM_FOOTER_BUTTON_HEIGHT = 50;
const PREMIUM_FOOTER_MIN_BOTTOM_SPACING = 19;
const PREMIUM_FOOTER_VERTICAL_OFFSET = 5;
const FUSE_UPGRADE_AMOUNT: Record<RewardsTier.PRIME | RewardsTier.ULTRA, string> = {
  [RewardsTier.PRIME]: '50k',
  [RewardsTier.ULTRA]: '400k',
};
// Extra height the fades extend beyond their bar's own content, so scrolled
// content dims out smoothly under the header / off the bottom edge instead of
// getting a hard clip (mirrors CardWaitingModal's FADE_EXTENT).
const FADE_EXTENT = 120;

interface TierPageProps {
  tier: RewardsTier;
  isCurrentTier: boolean;
  isDesktopLayout: boolean;
  /** Width of the page column — the window on mobile, the body column on desktop. */
  pageWidth: number;
}

const PremiumUpgradeFooter = ({
  selectedTier,
  onUpgradePress,
}: {
  selectedTier: RewardsTier;
  onUpgradePress: (tier: RewardsTier.PRIME | RewardsTier.ULTRA) => void;
}) => {
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const isVisible = selectedTier !== RewardsTier.CORE;
  const lastPremiumTier = useRef<RewardsTier.PRIME | RewardsTier.ULTRA>(RewardsTier.PRIME);

  if (selectedTier === RewardsTier.PRIME || selectedTier === RewardsTier.ULTRA) {
    lastPremiumTier.current = selectedTier;
  }

  const tier = lastPremiumTier.current;
  const fuseAmount = FUSE_UPGRADE_AMOUNT[tier];
  const bottomSpacing =
    Math.max(insets.bottom, PREMIUM_FOOTER_MIN_BOTTOM_SPACING) + PREMIUM_FOOTER_VERTICAL_OFFSET;
  const footerHeight = PREMIUM_FOOTER_BUTTON_TOP + PREMIUM_FOOTER_BUTTON_HEIGHT + bottomSpacing;
  const footerTranslateY = useSharedValue(isVisible ? 0 : footerHeight);

  useEffect(() => {
    footerTranslateY.value = reduceMotion
      ? isVisible
        ? 0
        : footerHeight
      : withTiming(isVisible ? 0 : footerHeight, {
          duration: PREMIUM_FOOTER_SLIDE_DURATION,
          easing: PREMIUM_FOOTER_SLIDE_EASING,
        });
  }, [footerHeight, footerTranslateY, isVisible, reduceMotion]);

  const footerAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: footerTranslateY.value }],
  }));

  return (
    <Animated.View
      pointerEvents={isVisible ? 'box-none' : 'none'}
      className="absolute bottom-0 left-0 right-0 z-20"
      style={[{ height: footerHeight }, footerAnimatedStyle]}
    >
      <LinearGradient
        colors={[`${BACKGROUND}00`, BACKGROUND]}
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: PREMIUM_FOOTER_FADE_HEIGHT,
        }}
      />
      <View
        pointerEvents="box-none"
        className="absolute bottom-0 left-0 right-0 items-center bg-[#0F0F10]"
        style={{ top: PREMIUM_FOOTER_FADE_HEIGHT }}
      >
        <Text
          className="mt-[11px] text-center text-white/70"
          style={{
            fontFamily: 'MonaSans_400Regular',
            fontSize: 16,
            lineHeight: 23,
          }}
        >
          Deposit {fuseAmount} FUSE to upgrade
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Deposit ${fuseAmount} FUSE to upgrade to ${TIER_LABELS[tier]}`}
          onPress={() => onUpgradePress(tier)}
          className="mx-[18px] mt-[14px] h-[50px] items-center justify-center self-stretch rounded-full bg-[#94F27F] transition-all active:scale-95 active:opacity-80"
        >
          <Text
            className="font-semibold text-black"
            style={{
              fontFamily: 'MonaSans_600SemiBold',
              fontSize: 16,
              lineHeight: 23,
            }}
          >
            Upgrade
          </Text>
        </Pressable>
      </View>
    </Animated.View>
  );
};

/**
 * One tier's full page of content — all three are mounted side by side (see
 * the pager row in the main component below) so a swipe genuinely drags
 * between real, already-rendered pages instead of faking it with a fade/slide
 * of a single swapped-out content block.
 */
const TierPage = ({ tier, isCurrentTier, isDesktopLayout, pageWidth }: TierPageProps) => {
  const insets = useSafeAreaInsets();
  const content = TIER_CONTENT[tier];
  const subtitle = isCurrentTier ? 'Your current tier' : content.unlockCopy;
  const pageTopSpacing =
    insets.top + HEADER_ROW_HEIGHT - (isDesktopLayout ? DESKTOP_HERO_TOP_REDUCTION : 0);

  if (tier === RewardsTier.CORE) {
    return (
      <View
        style={{
          width: pageWidth,
          paddingTop: pageTopSpacing,
          paddingBottom: insets.bottom + PAGE_BOTTOM_SPACING,
        }}
      >
        <View className="items-center pt-4">
          <TierHero tier={tier} />

          <View className="-mt-1 flex-row items-center gap-1">
            <CoreTierSparkle />
            <Text
              className="text-white/70"
              style={{
                fontFamily: 'MonaSans_500Medium',
                fontSize: 20,
                lineHeight: 24,
              }}
            >
              Core
            </Text>
          </View>

          <Text
            className="mt-3 w-[209px] text-center text-white"
            style={{
              fontFamily: 'MonaSans_500Medium',
              fontSize: 30,
              lineHeight: 30,
              letterSpacing: -1,
            }}
          >
            {content.headline}
          </Text>

          <Text
            className="mt-[14px] text-white/70"
            style={{
              fontFamily: 'MonaSans_400Regular',
              fontSize: 16,
              lineHeight: 18,
            }}
          >
            {subtitle}
          </Text>
        </View>

        <CoreSummaryAndPerks />
        <CoreCashbackCard />
        <CoreFeesCard />
      </View>
    );
  }

  return (
    <View
      style={{
        width: pageWidth,
        paddingTop: pageTopSpacing,
        paddingBottom:
          PREMIUM_FOOTER_BUTTON_TOP +
          PREMIUM_FOOTER_BUTTON_HEIGHT +
          Math.max(insets.bottom, PREMIUM_FOOTER_MIN_BOTTOM_SPACING) +
          PREMIUM_FOOTER_VERTICAL_OFFSET -
          PREMIUM_FOOTER_OVERLAP,
      }}
    >
      <View className="items-center pt-4">
        <TierHero tier={tier} />

        <View className="-mt-1 flex-row items-center gap-1">
          <Image
            source={tier === RewardsTier.PRIME ? PRIME_TIER_SPARKLE : ULTRA_TIER_SPARKLE}
            style={{ width: 20, height: 20 }}
            contentFit="contain"
          />
          <Text
            className="text-white/70"
            style={{
              fontFamily: 'MonaSans_500Medium',
              fontSize: 20,
              lineHeight: 24,
            }}
          >
            {TIER_LABELS[tier]}
          </Text>
        </View>

        <Text
          className="mt-3 text-center text-white"
          style={{
            width: tier === RewardsTier.PRIME ? 247 : 273,
            fontFamily: 'MonaSans_500Medium',
            fontSize: 30,
            lineHeight: 30,
            letterSpacing: -1,
          }}
        >
          {content.headline}
        </Text>

        <TierPointsSheet
          trigger={
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${subtitle}. Learn how to earn points`}
              hitSlop={8}
              className="mt-[14px] flex-row items-center gap-1"
            >
              <Text
                className="text-white/70"
                style={{
                  fontFamily: 'MonaSans_400Regular',
                  fontSize: 16,
                  lineHeight: 20,
                }}
              >
                {subtitle}
              </Text>
              <Image source={TIER_INFO} style={{ width: 20, height: 21 }} contentFit="contain" />
            </Pressable>
          }
        />
      </View>

      <PremiumSummaryAndPerks tier={tier} />
      <PremiumCashbackCard tier={tier} />
      <PremiumFeesCard tier={tier} />
    </View>
  );
};

export default function RewardsBenefitsScreenNew() {
  const { data: rewardsData } = useRewardsUserData();
  const [selectedTierOverride, setSelectedTierOverride] = useState<RewardsTier | null>(null);
  const [isUpgradeSheetOpen, setIsUpgradeSheetOpen] = useState(false);
  const [upgradeTier, setUpgradeTier] = useState<RewardsTier.PRIME | RewardsTier.ULTRA>(
    RewardsTier.PRIME,
  );
  const selectedTier = selectedTierOverride ?? rewardsData?.currentTier ?? RewardsTier.CORE;
  const insets = useSafeAreaInsets();
  const { selectToken: selectSavingsFundToken } = useSavingsFundFlow();
  const openBuyFuse = useSwapState(state => state.actions.openBuyFuse);
  // The pager's pages are as wide as the column the page gets, which on desktop is
  // the body column beside the sidebar rather than the whole window.
  const pageWidth = usePageWidth();
  const isSidebarShell = useIsSidebarShell();
  // Suspends the page's vertical ScrollView while a horizontal swipe is active,
  // so the two gestures (a plain RN ScrollView isn't gesture-handler-aware)
  // don't both react to the same touch and fight over the drag.
  const [isSwiping, setIsSwiping] = useState(false);

  // Pixel offset of the 3-wide pager row. -index * pageWidth is "at rest" on
  // that tier; onUpdate adds the live drag delta so real, already-rendered
  // neighboring pages follow the finger instead of faking a swipe with a
  // fade/slide of a single swapped-out content block.
  const translateX = useSharedValue(-TIERS.indexOf(selectedTier) * pageWidth);
  const isDragging = useSharedValue(false);

  useEffect(() => {
    if (isDragging.value) return;
    const index = TIERS.indexOf(selectedTier);
    translateX.value = withTiming(-index * pageWidth, {
      duration: SLIDE_DURATION,
      easing: SLIDE_EASING,
    });
  }, [selectedTier, translateX, isDragging, pageWidth]);

  const rowStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const handleUpgradePress = useCallback((tier: RewardsTier.PRIME | RewardsTier.ULTRA) => {
    setUpgradeTier(tier);
    setIsUpgradeSheetOpen(true);
  }, []);

  const handleDepositFuse = useCallback(() => {
    setIsUpgradeSheetOpen(false);

    const depositStore = useDepositStore.getState();
    depositStore.resetDepositFlow();
    depositStore.setSavingsFundIntent('savings');
    depositStore.setDepositFromSolid(false);
    selectSavingsFundToken('WFUSE');
  }, [selectSavingsFundToken]);

  const handleBuyFuse = useCallback(() => {
    setIsUpgradeSheetOpen(false);
    openBuyFuse(upgradeTier);
  }, [openBuyFuse, upgradeTier]);

  // Top fade sits over the scrolled content so the header + tier switcher stay
  // legible as content passes under them; the matching bottom fade dims content
  // off the bottom edge now that the tab bar no longer occupies it.
  const overlays = (
    <>
      <LinearGradient
        colors={[BACKGROUND, `${BACKGROUND}00`]}
        pointerEvents="box-none"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: insets.top + HEADER_TOP_SPACING + HEADER_ROW_HEIGHT + FADE_EXTENT,
          zIndex: 10,
        }}
      >
        {/* Constrained to the page column so the back button lines up with the
            content rather than floating out at the edge of the desktop body. */}
        <View
          className={`relative flex-row items-center justify-center px-4 ${SIDEBAR_BODY_WIDTH}`}
          style={{ height: HEADER_ROW_HEIGHT, marginTop: insets.top + HEADER_TOP_SPACING }}
        >
          {/* Stretched top-to-bottom so it centres on the tabs beside it. */}
          <View className="absolute bottom-0 left-4 top-0 justify-center">
            <BackButton variant="header" onPress={() => router.push(path.REWARDS)} />
          </View>
          <TierSwitcher
            tiers={TIERS}
            labels={TIER_LABELS}
            selected={selectedTier}
            onSelect={setSelectedTierOverride}
          />
        </View>
      </LinearGradient>

      <LinearGradient
        colors={[`${BACKGROUND}00`, BACKGROUND]}
        pointerEvents="none"
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: insets.bottom + FADE_EXTENT,
        }}
      />
      <PremiumUpgradeFooter selectedTier={selectedTier} onUpgradePress={handleUpgradePress} />
      <UpgradeTierSheet
        open={isUpgradeSheetOpen}
        tier={upgradeTier}
        onOpenChange={setIsUpgradeSheetOpen}
        onDepositFuse={handleDepositFuse}
        onBuyFuse={handleBuyFuse}
      />
    </>
  );

  // Only horizontal drags trigger a tier swap; vertical drags fall through to
  // the page's ScrollView untouched. onUpdate follows the finger in real time
  // (with rubber-banding past the first/last tier); onEnd either continues on
  // to the next/previous tier or snaps back to the current one.
  const swipeGesture = Gesture.Pan()
    .activeOffsetX([-10, 10])
    .failOffsetY([-10, 10])
    .onStart(() => {
      'worklet';
      isDragging.value = true;
      scheduleOnRN(setIsSwiping, true);
    })
    .onUpdate(event => {
      'worklet';
      const index = TIERS.indexOf(selectedTier);
      let dx = event.translationX;
      if (index === 0 && dx > 0) dx *= RUBBER_BAND_FACTOR;
      if (index === TIERS.length - 1 && dx < 0) dx *= RUBBER_BAND_FACTOR;
      translateX.value = -index * pageWidth + dx;
    })
    .onEnd(event => {
      'worklet';
      const index = TIERS.indexOf(selectedTier);
      const isSwipeLeft =
        event.translationX < -SWIPE_DISTANCE_THRESHOLD ||
        event.velocityX < -SWIPE_VELOCITY_THRESHOLD;
      const isSwipeRight =
        event.translationX > SWIPE_DISTANCE_THRESHOLD || event.velocityX > SWIPE_VELOCITY_THRESHOLD;

      let targetIndex = index;
      if (isSwipeLeft && index < TIERS.length - 1) targetIndex = index + 1;
      else if (isSwipeRight && index > 0) targetIndex = index - 1;

      translateX.value = withTiming(
        -targetIndex * pageWidth,
        { duration: SLIDE_DURATION, easing: SLIDE_EASING },
        finished => {
          if (finished && targetIndex !== index) {
            scheduleOnRN(setSelectedTierOverride, TIERS[targetIndex]);
          }
        },
      );
    })
    .onFinalize(() => {
      'worklet';
      isDragging.value = false;
      scheduleOnRN(setIsSwiping, false);
    });

  return (
    <PageLayout
      showNavbar={false}
      edges={['left', 'right']}
      additionalContent={overlays}
      scrollEnabled={!isSwiping}
    >
      <GestureDetector gesture={swipeGesture} touchAction="pan-y">
        {/* Desktop: the row is three columns wide, so clip the neighbouring tiers at
            the column's edge — on mobile they simply hang off-screen. */}
        <View style={isSidebarShell ? { width: pageWidth, overflow: 'hidden' } : undefined}>
          <Animated.View style={[{ flexDirection: 'row' }, rowStyle]}>
            {TIERS.map(tier => (
              <TierPage
                key={tier}
                tier={tier}
                isCurrentTier={rewardsData?.currentTier === tier}
                isDesktopLayout={isSidebarShell}
                pageWidth={pageWidth}
              />
            ))}
          </Animated.View>
        </View>
      </GestureDetector>
    </PageLayout>
  );
}
