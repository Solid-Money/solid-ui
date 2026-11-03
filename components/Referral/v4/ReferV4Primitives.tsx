import { type ReactNode, useEffect } from 'react';
import { Linking, Platform, Pressable, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { Image } from 'expo-image';

import { BackButton } from '@/components/ui/back-button';
import { Text } from '@/components/ui/text';
import { path } from '@/constants/path';
import { type AssetPath, getAsset } from '@/lib/assets';
import { friendInitials } from '@/lib/referral/referralV4';
import { cn } from '@/lib/utils';

/**
 * The building blocks the referral v4 screens and sheets share (Figma section
 * 29541:13149). Colours are the design's: the app's card surface (#1C1C1C) and
 * brand green, with text at the opacities the frames use.
 */

/** Literal brand green, for props that can't take a class (icon tints, fills). */
export const REFER_ACCENT = '#94F27F';

/** "Read the full terms" on every reward sheet. */
export const REFERRAL_TERMS_URL =
  'https://support.solid.xyz/en/articles/15613716-solid-rewards-terms-and-conditions';

/** Reanimated's take on the design's "ease out expo" — the hero avatars' curve. */
const FILL_EASING = Easing.bezier(0.16, 1, 0.3, 1);

export type ReferRewardKind = 'spendShare' | 'welcome' | 'bigSpender' | 'upgrade';

/** Figma draws each icon at three sizes (tile, list row, sheet), each its own drawing. */
type RewardIconSize = 32 | 36 | 56;

const REWARD_ICONS: Record<ReferRewardKind, Record<RewardIconSize, AssetPath>> = {
  spendShare: {
    32: 'images/referral-v4/reward-share-32.svg',
    36: 'images/referral-v4/reward-share-36.svg',
    56: 'images/referral-v4/reward-share-56.svg',
  },
  welcome: {
    32: 'images/referral-v4/reward-welcome-32.svg',
    36: 'images/referral-v4/reward-welcome-36.svg',
    56: 'images/referral-v4/reward-welcome-56.svg',
  },
  bigSpender: {
    32: 'images/referral-v4/reward-big-spender-32.svg',
    36: 'images/referral-v4/reward-big-spender-36.svg',
    56: 'images/referral-v4/reward-big-spender-56.svg',
  },
  upgrade: {
    32: 'images/referral-v4/reward-upgrade-32.svg',
    36: 'images/referral-v4/reward-upgrade-36.svg',
    56: 'images/referral-v4/reward-upgrade-56.svg',
  },
};

export const RewardIcon = ({ kind, size }: { kind: ReferRewardKind; size: RewardIconSize }) => (
  <Image
    source={getAsset(REWARD_ICONS[kind][size])}
    style={{ width: size, height: size }}
    contentFit="contain"
    accessibilityElementsHidden
    importantForAccessibility="no"
  />
);

/** A small asset icon at its design size. */
export const ReferIcon = ({ asset, size }: { asset: AssetPath; size: number }) => (
  <Image
    source={getAsset(asset)}
    style={{ width: size, height: size }}
    contentFit="contain"
    accessibilityElementsHidden
    importantForAccessibility="no"
  />
);

/**
 * A friend's initials in a round #303030 tile. `ringed` adds the 2pt ring the
 * stacked avatars on the Refer screen overlap with.
 */
export const FriendAvatar = ({
  username,
  size = 40,
  ringed = false,
  style,
}: {
  username: string;
  size?: 28 | 32 | 40;
  ringed?: boolean;
  style?: object;
}) => (
  <View
    className={cn(
      'items-center justify-center overflow-hidden rounded-full bg-[#303030]',
      ringed && 'border-2 border-card',
    )}
    style={[{ width: size, height: size }, style]}
  >
    <Text
      className={cn('font-semibold text-white/85', size === 40 ? 'text-[13px]' : 'text-[11px]')}
    >
      {friendInitials(username)}
    </Text>
  </View>
);

/** Back on the left, the screen's name centred (Figma "Top bar"). */
export const ReferHeader = ({ title, onBack }: { title?: string; onBack?: () => void }) => (
  <View className="relative min-h-[50px] flex-row items-center justify-center px-4">
    <View className="absolute left-4">
      <BackButton variant="header" fallbackHref={path.REWARDS as string} onPress={onBack} />
    </View>
    {title ? (
      <Text className="mx-16 text-center text-[17px] font-semibold text-white" numberOfLines={1}>
        {title}
      </Text>
    ) : null}
  </View>
);

/**
 * The 6pt bar the friend screens measure progress with. It fills on mount, on
 * the same curve as the hero avatars, so the screen reads as "here is how far
 * along they are" rather than as a static figure.
 */
export const ReferProgressBar = ({ ratio, className }: { ratio: number; className?: string }) => {
  const width = useSharedValue(0);

  useEffect(() => {
    width.value = withDelay(
      120,
      withTiming(Math.min(1, Math.max(0, ratio)), { duration: 700, easing: FILL_EASING }),
    );
  }, [ratio, width]);

  const fillStyle = useAnimatedStyle(() => ({ width: `${width.value * 100}%` }));

  return (
    <View
      className={cn('h-[6px] w-full overflow-hidden rounded-[3px] bg-white/10', className)}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(Math.min(1, ratio) * 100) }}
    >
      {/* Styled through `style`: className is inert on Reanimated components. */}
      <Animated.View
        style={[
          // A sliver even at zero, the way Figma draws an empty bar.
          { height: 6, minWidth: 6, borderRadius: 3, backgroundColor: REFER_ACCENT },
          fillStyle,
        ]}
      />
    </View>
  );
};

/** The hairline between list rows. */
export const ReferDivider = () => <View className="h-px w-full bg-white/[0.06]" />;

interface ReferStat {
  label: string;
  value: string;
}

const StatColumn = ({ stat }: { stat: ReferStat }) => (
  <View className="flex-1 items-center px-2.5 pt-[14px]">
    <Text className="text-center text-[14px] leading-4 text-white/70" numberOfLines={1}>
      {stat.label}
    </Text>
    <Text
      className="mt-[10px] text-center text-[20px] font-semibold leading-[26px] text-white"
      numberOfLines={1}
    >
      {stat.value}
    </Text>
  </View>
);

/**
 * Two figures side by side — "This month" and "Total" (Figma 30229:14240), or
 * "This month" and "Next payout" — the way the Rewards card shows them. `bare`
 * drops the card surface, for when it heads a card of its own.
 */
export const ReferStats = ({
  left,
  right,
  bare = false,
}: {
  left: ReferStat;
  right: ReferStat;
  bare?: boolean;
}) => (
  <View
    className={cn('h-20 flex-row overflow-hidden', !bare && 'rounded-[20px] bg-card')}
    accessible
    accessibilityLabel={`${left.label} ${left.value}, ${right.label} ${right.value}`}
  >
    <StatColumn stat={left} />
    <View className="my-[3px] w-px bg-white/10" />
    <StatColumn stat={right} />
  </View>
);

export type ReferRuleIcon = 'clock' | 'friends';

const RULE_ICONS: Record<ReferRuleIcon, AssetPath> = {
  clock: 'images/referral-v4/clock.svg',
  friends: 'images/referral-v4/friends.svg',
};

export interface ReferRule {
  icon: ReferRuleIcon;
  text: string;
}

/** When and how a reward is paid, one line each (Figma "Payout rules"). */
export const ReferRules = ({ rules }: { rules: ReferRule[] }) => (
  <View className="w-full overflow-hidden rounded-[20px] bg-white/[0.05] px-4 py-1">
    {rules.map((rule, index) => (
      <View key={rule.text}>
        {index > 0 ? <ReferDivider /> : null}
        <View className="flex-row items-center gap-[10px] py-[13px]">
          <ReferIcon asset={RULE_ICONS[rule.icon]} size={20} />
          <Text className="min-w-0 flex-1 text-[14px] text-white/85">{rule.text}</Text>
        </View>
      </View>
    ))}
  </View>
);

/** A grouped list on the card surface (Figma "Friends", "Rewards", "Steps"). */
export const ReferList = ({ children, className }: { children: ReactNode; className?: string }) => (
  <View className={cn('w-full overflow-hidden rounded-[20px] bg-card px-4 py-1', className)}>
    {children}
  </View>
);

/**
 * A quiet line under a card — payouts paused, a reversed bonus being repaid —
 * in the screens' note style: small, dimmed, no surface of its own.
 */
export const ReferNote = ({ children }: { children: string }) => (
  <Text className="px-1 text-[13px] leading-[18px] text-white/50">{children}</Text>
);

/** The green amount chip under a sheet's title. */
export const ReferAmountChip = ({ label }: { label: string }) => (
  <View className="rounded-full bg-[rgba(148,242,127,0.14)] px-[14px] py-[7px]">
    <Text className="text-[14px] font-semibold text-brand">{label}</Text>
  </View>
);

/** The round close control in a sheet's top-right corner. */
export const ReferSheetClose = ({ onPress }: { onPress: () => void }) => (
  <View className="w-full flex-row justify-end">
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Close"
      hitSlop={8}
      className="active:opacity-70 web:hover:opacity-80"
    >
      <ReferIcon asset="images/referral-v4/close.svg" size={36} />
    </Pressable>
  </View>
);

/** "Read the full terms" — opens the rewards terms. */
export const ReferTermsLink = () => (
  <Pressable
    accessibilityRole="link"
    accessibilityLabel="Open the referral terms"
    hitSlop={8}
    onPress={() => {
      if (Platform.OS === 'web') {
        window.open(REFERRAL_TERMS_URL, '_blank', 'noopener,noreferrer');
        return;
      }
      void Linking.openURL(REFERRAL_TERMS_URL).catch(error =>
        console.error('Failed to open the referral terms:', error),
      );
    }}
    className="self-center active:opacity-70 web:hover:opacity-80"
  >
    <Text className="text-center text-[12px] text-white/35 underline">Read the full terms</Text>
  </Pressable>
);
