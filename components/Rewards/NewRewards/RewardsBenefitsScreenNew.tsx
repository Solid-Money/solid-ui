import { useEffect, useRef, useState } from 'react';
import { Dimensions, LayoutChangeEvent, Pressable, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import {
  CreditCard,
  DollarSign,
  Globe,
  LucideIcon,
  Percent,
  Rocket,
  Zap,
} from 'lucide-react-native';

import PageLayout from '@/components/PageLayout';
import { BackButton } from '@/components/ui/back-button';
import { Text } from '@/components/ui/text';
import { path } from '@/constants/path';
import { useRewardsUserData } from '@/hooks/useRewards';
import { type AssetPath, getAsset } from '@/lib/assets';
import { RewardsTier } from '@/lib/types';
import { cn } from '@/lib/utils';

const TIERS = [RewardsTier.CORE, RewardsTier.PRIME, RewardsTier.ULTRA];

const TIER_LABELS: Record<RewardsTier, string> = {
  [RewardsTier.CORE]: 'Core',
  [RewardsTier.PRIME]: 'Prime',
  [RewardsTier.ULTRA]: 'Ultra',
};

const TIER_HERO_ASSET: Record<RewardsTier, AssetPath> = {
  [RewardsTier.CORE]: 'images/rewards-tiers/hero-core.png',
  [RewardsTier.PRIME]: 'images/rewards-tiers/hero-prime.png',
  [RewardsTier.ULTRA]: 'images/rewards-tiers/hero-ultra.png',
};

const SPARKLE_ASSET: AssetPath = 'images/rewards-tiers/hero-core.png';

interface TierStat {
  label: string;
  value: string;
}

interface TierPerk {
  Icon: LucideIcon;
  title: string;
  description: string;
}

interface CashbackCategory {
  label: string;
  value: string | null;
  logos: AssetPath[];
}

interface TierContent {
  headline: string;
  unlockCopy: string;
  stats: TierStat[];
  perks: TierPerk[];
  cashback: { everyPurchase: string; categories: CashbackCategory[] };
  fees: { cardFees: string; bankDeposit: string; swaps: string; cashbackCap: string };
}

const AI_LOGOS: AssetPath[] = [
  'images/rewards-tiers/logo-openai.svg',
  'images/rewards-tiers/logo-claude.svg',
  'images/rewards-tiers/logo-gemini.svg',
];
const STREAMING_LOGOS: AssetPath[] = [
  'images/rewards-tiers/logo-netflix.svg',
  'images/rewards-tiers/logo-disney-1.svg',
  'images/rewards-tiers/logo-generic-1.svg',
];
const MUSIC_LOGOS: AssetPath[] = [
  'images/rewards-tiers/logo-generic-2.svg',
  'images/rewards-tiers/logo-generic-4.svg',
  'images/rewards-tiers/logo-generic-5.svg',
];

const TIER_CONTENT: Record<RewardsTier, TierContent> = {
  [RewardsTier.CORE]: {
    headline: 'Start spending with Solid',
    unlockCopy: 'Your current tier',
    stats: [
      { label: 'Cashback', value: '3%' },
      { label: 'APY', value: '5.5%' },
    ],
    perks: [
      { Icon: CreditCard, title: 'Free virtual card', description: 'Issued instantly' },
      { Icon: Rocket, title: 'Set up in minutes', description: 'Under 5 minutes' },
      { Icon: Globe, title: 'Spend globally', description: 'Card accepted in 180+ countries' },
    ],
    cashback: {
      everyPurchase: '3%',
      categories: [
        { label: 'AI', value: null, logos: [] },
        { label: 'Streaming', value: null, logos: [] },
        { label: 'Music', value: null, logos: [] },
      ],
    },
    fees: {
      cardFees: 'Free',
      bankDeposit: 'Free',
      swaps: 'Free',
      cashbackCap: 'Up to 50$ monthly',
    },
  },
  [RewardsTier.PRIME]: {
    headline: 'Built for everyday spending',
    unlockCopy: 'Unlocks at 5M points',
    stats: [
      { label: 'Cashback', value: '4%' },
      { label: 'APY', value: '5.5%' },
      { label: 'Yield boost', value: '2%' },
    ],
    perks: [
      { Icon: Zap, title: 'Yield boost', description: 'Earn 2% yield on top of your APY' },
      {
        Icon: Percent,
        title: 'Subscription discounts',
        description: '25% back on AI, streaming, music',
      },
      { Icon: DollarSign, title: 'Higher cashback caps', description: 'Up to $50 monthly cap' },
    ],
    cashback: {
      everyPurchase: '4%',
      categories: [
        { label: 'AI', value: '25%', logos: AI_LOGOS },
        { label: 'Streaming', value: '25%', logos: STREAMING_LOGOS },
        { label: 'Music', value: '25%', logos: MUSIC_LOGOS },
      ],
    },
    fees: {
      cardFees: 'Free',
      bankDeposit: 'Free',
      swaps: 'Free',
      cashbackCap: 'Up to 50$ monthly',
    },
  },
  [RewardsTier.ULTRA]: {
    headline: 'For those who never settle',
    unlockCopy: 'Unlocks at 35M Points',
    stats: [
      { label: 'Cashback', value: '5%' },
      { label: 'APY', value: '5.5%' },
      { label: 'Yield boost', value: '3%' },
    ],
    perks: [
      { Icon: Zap, title: 'Yield boost', description: '+3% APY boost on your savings' },
      {
        Icon: Percent,
        title: 'Subscription discounts',
        description: '50% back on AI, streaming, music',
      },
      { Icon: DollarSign, title: 'Higher cashback caps', description: 'Up to $50 monthly cap' },
    ],
    cashback: {
      everyPurchase: '5%',
      categories: [
        { label: 'AI', value: '50%', logos: AI_LOGOS },
        { label: 'Streaming', value: '50%', logos: STREAMING_LOGOS },
        { label: 'Music', value: '50%', logos: MUSIC_LOGOS },
      ],
    },
    fees: {
      cardFees: 'Free',
      bankDeposit: 'Free',
      swaps: 'Free',
      cashbackCap: 'Up to 50$ monthly',
    },
  },
};

interface TierSwitcherProps {
  selected: RewardsTier;
  onSelect: (tier: RewardsTier) => void;
}

type SegmentLayout = { x: number; width: number };

const TierSwitcher = ({ selected, onSelect }: TierSwitcherProps) => {
  const layouts = useRef<Partial<Record<RewardsTier, SegmentLayout>>>({});
  const indicatorX = useSharedValue(0);
  const indicatorWidth = useSharedValue(0);

  const handleLayout = (tier: RewardsTier) => (event: LayoutChangeEvent) => {
    const { x, width } = event.nativeEvent.layout;
    layouts.current[tier] = { x, width };
    if (tier === selected) {
      indicatorX.value = x;
      indicatorWidth.value = width;
    }
  };

  useEffect(() => {
    const layout = layouts.current[selected];
    if (!layout) return;
    indicatorX.value = withTiming(layout.x, { duration: 250 });
    indicatorWidth.value = withTiming(layout.width, { duration: 250 });
  }, [selected, indicatorX, indicatorWidth]);

  const indicatorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: indicatorX.value }],
    width: indicatorWidth.value,
  }));

  return (
    <View className="h-[33px] flex-row items-center self-center rounded-full border border-white/10 bg-black p-1">
      <Animated.View
        className="absolute bottom-1 top-1 rounded-full bg-white/15"
        style={indicatorStyle}
      />
      {TIERS.map(tier => (
        <Pressable
          key={tier}
          onPress={() => onSelect(tier)}
          onLayout={handleLayout(tier)}
          className="items-center justify-center px-5"
        >
          <Text
            className={cn('text-sm font-medium text-white', tier !== selected && 'text-white/70')}
          >
            {TIER_LABELS[tier]}
          </Text>
        </Pressable>
      ))}
    </View>
  );
};

interface LogoBadgeProps {
  asset: AssetPath;
  overlap?: boolean;
}

const LogoBadge = ({ asset, overlap }: LogoBadgeProps) => (
  <View
    className="h-[22px] w-[22px] items-center justify-center overflow-hidden rounded-full border-2 border-card bg-white"
    style={overlap ? { marginLeft: -6 } : undefined}
  >
    <Image source={getAsset(asset)} style={{ width: 14, height: 14 }} contentFit="contain" />
  </View>
);

const DIVIDER_STYLE = {
  height: 1,
  marginHorizontal: 16,
  backgroundColor: 'rgba(255,255,255,0.15)',
};
const Divider = () => <View style={DIVIDER_STYLE} />;

interface FeeRowProps {
  label: string;
  value: string;
  emphasize?: boolean;
  pill?: boolean;
}

const FeeRow = ({ label, value, emphasize, pill = true }: FeeRowProps) => (
  <View className="flex-row items-center justify-between px-4 py-2">
    <Text className={cn('text-base text-white', emphasize ? 'font-semibold' : 'font-medium')}>
      {label}
    </Text>
    {pill ? (
      <View className="rounded-full bg-white/10 px-4 py-2">
        <Text className="text-base font-medium text-white">{value}</Text>
      </View>
    ) : (
      <Text className="text-base font-medium text-white">{value}</Text>
    )}
  </View>
);

/**
 * Redesigned "Explore tiers" screen (Apple "glass" style companion to
 * RewardsScreenNew). Reachable from the "Explore tiers" button on the
 * redesigned rewards home screen. Shown only on qa/preview mobile builds via
 * the dispatcher in rewards/benefits.tsx — desktop keeps the legacy
 * CompareTiersTable-based screen.
 */
const HEADER_ROW_HEIGHT = 56;
const SLIDE_DURATION = 260;
const SLIDE_EASING = Easing.out(Easing.cubic);
const SWIPE_DISTANCE_THRESHOLD = 50;
const SWIPE_VELOCITY_THRESHOLD = 400;
const SCREEN_WIDTH = Dimensions.get('window').width;
// Dampens the drag past the first/last tier so it feels like it's resisting.
const RUBBER_BAND_FACTOR = 0.3;

interface TierPageProps {
  tier: RewardsTier;
  isCurrentTier: boolean;
}

/**
 * One tier's full page of content — all three are mounted side by side (see
 * the pager row in the main component below) so a swipe genuinely drags
 * between real, already-rendered pages instead of faking it with a fade/slide
 * of a single swapped-out content block.
 */
const TierPage = ({ tier, isCurrentTier }: TierPageProps) => {
  const insets = useSafeAreaInsets();
  const content = TIER_CONTENT[tier];
  const subtitle = isCurrentTier ? 'Your current tier' : content.unlockCopy;

  return (
    <View
      className="gap-6 pb-24"
      style={{ width: SCREEN_WIDTH, paddingTop: insets.top + HEADER_ROW_HEIGHT }}
    >
      <View className="items-center gap-1 pt-4">
        <View className="h-[320px] w-[320px] items-center justify-center">
          <Image
            source={getAsset('images/rewards-tiers/glow.svg')}
            style={{ position: 'absolute', width: 340, height: 340 }}
            contentFit="contain"
          />
          <Image
            source={getAsset(TIER_HERO_ASSET[tier])}
            style={{ width: 220, height: 220 }}
            contentFit="contain"
          />
        </View>

        <Text className="text-base font-medium text-muted-foreground">{TIER_LABELS[tier]}</Text>

        <Text
          className="max-w-[260px] text-center text-[28px] font-medium leading-[1.15] text-white"
          style={{ letterSpacing: -0.5 }}
        >
          {content.headline}
        </Text>

        <View className="flex-row items-center gap-1.5">
          <Image
            source={getAsset(SPARKLE_ASSET)}
            style={{ width: 12, height: 12 }}
            contentFit="contain"
          />
          <Text className="text-base text-muted-foreground">{subtitle}</Text>
        </View>
      </View>

      <View className="mx-4 overflow-hidden rounded-twice">
        <LinearGradient
          colors={['rgba(148,242,127,0.1)', 'rgba(148,242,127,0)']}
          style={StyleSheet.absoluteFillObject}
        />
        <View className="flex-row">
          {content.stats.map((stat, index) => (
            <View
              key={stat.label}
              className={cn(
                'flex-1 items-center gap-1 py-5',
                index > 0 && 'border-l border-white/10',
              )}
            >
              <Text className="text-2xl font-medium text-[#94f27f]">{stat.value}</Text>
              <Text className="text-base text-muted-foreground">{stat.label}</Text>
            </View>
          ))}
        </View>
      </View>

      <View className="mx-4 rounded-twice bg-card">
        {content.perks.map((perk, index) => (
          <View key={perk.title}>
            {index > 0 && <Divider />}
            <View className="flex-row items-center justify-between p-4">
              <View className="flex-1 gap-1 pr-3">
                <Text className="text-base font-medium text-white">{perk.title}</Text>
                <Text className="text-sm text-muted-foreground">{perk.description}</Text>
              </View>
              <View className="h-11 w-11 items-center justify-center rounded-full bg-white/10">
                <perk.Icon size={20} color="#ffffff" />
              </View>
            </View>
          </View>
        ))}
      </View>

      <View className="mx-4 rounded-twice bg-card pb-3">
        <Text className="px-4 pb-2 pt-4 text-base text-muted-foreground">Cashback</Text>
        <Divider />
        <FeeRow label="Every purchase" value={content.cashback.everyPurchase} />
        {content.cashback.categories.map(category => (
          <View key={category.label}>
            <View className="flex-row items-center justify-between px-4 py-2">
              <Text
                className={cn(
                  'text-base font-medium text-white',
                  !category.value && 'text-white/40',
                )}
              >
                {category.label}
              </Text>
              {category.value ? (
                <View className="flex-row items-center gap-2">
                  <View className="flex-row">
                    {category.logos.map((logo, index) => (
                      <LogoBadge key={logo} asset={logo} overlap={index > 0} />
                    ))}
                  </View>
                  <View className="rounded-full bg-white/10 px-3 py-2">
                    <Text className="text-base font-medium text-white">{category.value}</Text>
                  </View>
                </View>
              ) : (
                <Text className="text-base font-medium text-white/40">Prime and up</Text>
              )}
            </View>
          </View>
        ))}
      </View>

      <View className="mx-4 rounded-twice bg-card pb-3">
        <Text className="px-4 pb-2 pt-4 text-base text-muted-foreground">Fees & Caps</Text>
        <Divider />
        <FeeRow label="Card fees" value={content.fees.cardFees} />
        <FeeRow label="Bank deposit" value={content.fees.bankDeposit} emphasize />
        <FeeRow label="Swaps" value={content.fees.swaps} emphasize />
        <FeeRow label="Cashback cap" value={content.fees.cashbackCap} emphasize pill={false} />
      </View>
    </View>
  );
};

export default function RewardsBenefitsScreenNew() {
  const { data: rewardsData } = useRewardsUserData();
  const [selectedTier, setSelectedTier] = useState<RewardsTier>(
    () => rewardsData?.currentTier ?? RewardsTier.CORE,
  );
  const insets = useSafeAreaInsets();
  // Suspends the page's vertical ScrollView while a horizontal swipe is active,
  // so the two gestures (a plain RN ScrollView isn't gesture-handler-aware)
  // don't both react to the same touch and fight over the drag.
  const [isSwiping, setIsSwiping] = useState(false);

  // Pixel offset of the 3-wide pager row. -index * SCREEN_WIDTH is "at rest" on
  // that tier; onUpdate adds the live drag delta so real, already-rendered
  // neighboring pages follow the finger instead of faking a swipe with a
  // fade/slide of a single swapped-out content block.
  const translateX = useSharedValue(-TIERS.indexOf(selectedTier) * SCREEN_WIDTH);
  const isDragging = useSharedValue(false);

  useEffect(() => {
    if (isDragging.value) return;
    const index = TIERS.indexOf(selectedTier);
    translateX.value = withTiming(-index * SCREEN_WIDTH, {
      duration: SLIDE_DURATION,
      easing: SLIDE_EASING,
    });
  }, [selectedTier, translateX, isDragging]);

  const rowStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const header = (
    <View
      className="absolute left-0 right-0 top-0 z-10 flex-row items-center justify-center px-4"
      style={{ height: HEADER_ROW_HEIGHT, marginTop: insets.top }}
    >
      <View className="absolute left-4">
        <BackButton onPress={() => router.push(path.REWARDS)} />
      </View>
      <TierSwitcher selected={selectedTier} onSelect={setSelectedTier} />
    </View>
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
      translateX.value = -index * SCREEN_WIDTH + dx;
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
        -targetIndex * SCREEN_WIDTH,
        { duration: SLIDE_DURATION, easing: SLIDE_EASING },
        finished => {
          if (finished && targetIndex !== index) {
            scheduleOnRN(setSelectedTier, TIERS[targetIndex]);
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
      edges={['left', 'right', 'bottom']}
      additionalContent={header}
      scrollEnabled={!isSwiping}
    >
      <GestureDetector gesture={swipeGesture}>
        <Animated.View style={[{ flexDirection: 'row' }, rowStyle]}>
          {TIERS.map(tier => (
            <TierPage key={tier} tier={tier} isCurrentTier={rewardsData?.currentTier === tier} />
          ))}
        </Animated.View>
      </GestureDetector>
    </PageLayout>
  );
}
