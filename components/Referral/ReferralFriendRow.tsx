import React, { useEffect, useMemo } from 'react';
import { Linking, Pressable, View } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { ExternalLink } from 'lucide-react-native';

import { Text } from '@/components/ui/text';
import { useReferralCountdown } from '@/hooks/useReferralCountdown';
import { ReferralFriendStage, ReferralRewardListItem } from '@/lib/types';
import { cn } from '@/lib/utils';

/** Dollars with the sign always leading — "$15", never "15$". */
export const formatUsdWhole = (value: number) =>
  `$${Math.round(value || 0).toLocaleString('en-US')}`;

/** Dollars with cents, sign leading. */
export const formatUsd = (value: number) =>
  `$${(value || 0).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

/** Compact dollars for inline progress — "$91" / "$91.50". */
const formatUsdCompact = (value: number) => {
  const amount = value || 0;
  return Number.isInteger(amount) ? formatUsdWhole(amount) : formatUsd(amount);
};

const formatJoined = (iso: string) => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return `Joined ${date.toLocaleDateString('en-US', { month: 'short', day: '2-digit' })}`;
};

/**
 * Literal form of the `--referral-success` token. CSS variables don't resolve
 * in React Native `color` props, so icon tints need the resolved value; keep
 * this in step with the token in global.css.
 */
export const REFERRAL_SUCCESS_COLOR = '#68DB94';

/** Literal form of `--referral-progress`, for the same reason. */
const REFERRAL_PROGRESS_COLOR = '#6CC7FF';

type ChipTone = 'neutral' | 'progress' | 'success' | 'unlocking' | 'warning';

const CHIP_TONE: Record<ChipTone, { container: string; text: string }> = {
  neutral: { container: 'bg-white/[0.08]', text: 'text-white/60' },
  progress: { container: 'bg-referral-progress/[0.12]', text: 'text-referral-progress' },
  success: { container: 'bg-referral-success/[0.12]', text: 'text-referral-success' },
  unlocking: { container: 'bg-referral-unlocking/[0.12]', text: 'text-referral-unlocking' },
  warning: { container: 'bg-rewards/[0.12]', text: 'text-rewards' },
};

function Chip({
  tone,
  children,
  className,
}: {
  tone: ChipTone;
  children: React.ReactNode;
  className?: string;
}) {
  const style = CHIP_TONE[tone];
  return (
    <View
      className={cn(
        'items-center justify-center rounded-xl px-2 py-[5px]',
        style.container,
        className,
      )}
    >
      <Text className={cn('text-[11px] font-medium leading-[14px]', style.text)}>{children}</Text>
    </View>
  );
}

/**
 * Thin bar under the friend's name showing spend progress toward the bar.
 * Fills on mount so opening the screen reads as "here's how far along they are"
 * rather than a static number.
 */
function SpendProgress({ ratio, tone }: { ratio: number; tone: ChipTone }) {
  const width = useSharedValue(0);

  useEffect(() => {
    width.value = withDelay(
      120,
      withTiming(Math.min(1, Math.max(0, ratio)), {
        duration: 700,
        easing: Easing.bezier(0.16, 1, 0.3, 1),
      }),
    );
  }, [ratio, width]);

  const animatedStyle = useAnimatedStyle(() => ({
    width: `${width.value * 100}%`,
  }));

  // The fill is itself an Animated.View, so its appearance goes through `style`
  // rather than className — see the note on the row below for why className is
  // inert on Reanimated components.
  return (
    <View className="h-[3px] w-full overflow-hidden rounded-full bg-white/10">
      <Animated.View
        style={[
          {
            height: '100%',
            borderRadius: 999,
            backgroundColor: tone === 'success' ? REFERRAL_SUCCESS_COLOR : REFERRAL_PROGRESS_COLOR,
          },
          animatedStyle,
        ]}
      />
    </View>
  );
}

interface StagePresentation {
  /** The coloured chip under the friend's details. */
  detail: { tone: ChipTone; label: string } | null;
  /** The lifecycle chip on the right. */
  lifecycle: { tone: ChipTone; label: string };
  /** Show the spend progress bar. */
  showProgress: boolean;
}

interface ReferralFriendRowProps {
  item: ReferralRewardListItem;
  index: number;
  spendTargetUsd: number;
  merchantTarget: number;
  /** Called when a countdown reaches zero, so the screen can re-fetch. */
  onPayoutDue?: () => void;
}

export default function ReferralFriendRow({
  item,
  index,
  spendTargetUsd,
  merchantTarget,
  onPayoutDue,
}: ReferralFriendRowProps) {
  const countdown = useReferralCountdown(
    item.stage === ReferralFriendStage.REWARD_UNLOCKING ? item.payoutEtaAt : null,
  );

  // The countdown running out means the payout sweep is due — not that the
  // money has landed. Tell the screen to re-fetch and keep showing "Paying
  // out…" until the API reports PAID, so the UI never promises a payment the
  // backend hasn't made.
  const hasElapsed = countdown?.isElapsed ?? false;
  useEffect(() => {
    if (hasElapsed) onPayoutDue?.();
  }, [hasElapsed, onPayoutDue]);

  const presentation = useMemo<StagePresentation>(() => {
    const reward = formatUsdWhole(item.rewardUsd);

    switch (item.stage) {
      case ReferralFriendStage.PAID:
        return {
          detail: { tone: 'success', label: `Reward unlocked +${reward}` },
          lifecycle: { tone: 'success', label: 'Completed' },
          showProgress: false,
        };
      case ReferralFriendStage.REWARD_UNLOCKING:
        return {
          detail: {
            tone: 'unlocking',
            label: hasElapsed
              ? `${reward} paying out…`
              : countdown
                ? `${reward} unlocks in ${countdown.label}`
                : `${reward} unlocking`,
          },
          lifecycle: { tone: 'success', label: 'Qualified' },
          showProgress: false,
        };
      case ReferralFriendStage.UNDER_REVIEW:
        return {
          detail: { tone: 'unlocking', label: `${reward} in review` },
          lifecycle: { tone: 'neutral', label: 'In review' },
          showProgress: false,
        };
      case ReferralFriendStage.SPENDING:
        return {
          detail: {
            tone: 'progress',
            label: `${formatUsdCompact(Math.max(0, spendTargetUsd - item.spendUsd))} to go`,
          },
          lifecycle: { tone: 'neutral', label: 'Pending' },
          showProgress: true,
        };
      case ReferralFriendStage.CARD_ORDERED:
        return {
          detail: { tone: 'warning', label: 'Card not active' },
          lifecycle: { tone: 'neutral', label: 'Pending' },
          showProgress: false,
        };
      case ReferralFriendStage.VERIFYING:
        return {
          detail: { tone: 'warning', label: 'Verifying' },
          lifecycle: { tone: 'neutral', label: 'Pending' },
          showProgress: false,
        };
      case ReferralFriendStage.EXPIRED:
        return {
          detail: null,
          lifecycle: { tone: 'neutral', label: 'Expired' },
          showProgress: false,
        };
      case ReferralFriendStage.REVERSED:
        return {
          detail: null,
          lifecycle: { tone: 'neutral', label: 'Reversed' },
          showProgress: false,
        };
      case ReferralFriendStage.REGISTERED:
      default:
        return {
          detail: { tone: 'warning', label: 'No card' },
          lifecycle: { tone: 'neutral', label: 'Pending' },
          showProgress: false,
        };
    }
  }, [item.stage, item.rewardUsd, item.spendUsd, spendTargetUsd, countdown, hasElapsed]);

  const isPaidWithProof = item.stage === ReferralFriendStage.PAID && !!item.payoutTxUrl;

  const handleOpenPayout = () => {
    if (!item.payoutTxUrl) return;
    void Linking.openURL(item.payoutTxUrl).catch(error =>
      console.error('Failed to open referral payout transaction:', error),
    );
  };

  const spentLine =
    item.stage === ReferralFriendStage.REGISTERED || !item.hasActiveCard
      ? `${formatUsdCompact(item.spendUsd)} spent`
      : `${formatUsdCompact(item.spendUsd)}/${formatUsdWhole(spendTargetUsd)} spent · ${item.merchantCount}/${merchantTarget} merchants`;

  const detailChip = presentation.detail ? (
    <Chip tone={presentation.detail.tone}>{presentation.detail.label}</Chip>
  ) : null;

  return (
    // Animation only — no `className` here. NativeWind's JSX transform maps
    // className→style for React Native's own components; Reanimated's
    // Animated.View is a createAnimatedComponent wrapper, so className is
    // accepted as an unknown prop and silently dropped. Layout therefore lives
    // on the plain View below.
    <Animated.View
      // Rows cascade in rather than all appearing at once — same easing family
      // as the hero avatars so the screen reads as one motion system.
      entering={FadeIn.delay(Math.min(index, 8) * 60).duration(320)}
    >
      <View
        // Three columns: numbering, details, status. `items-center` matches the
        // design, which centres the status pill against the row rather than
        // aligning it to the name: the pill sits at y=38.5 with height 24 in a
        // 100px row, so its centre lands on the row's centre.
        //
        // The divider is driven off `index` rather than a `first:` variant.
        // NativeWind only maps hover/active/focus/disabled/empty pseudo-classes;
        // anything else — `:first-child` included — is discarded when the
        // stylesheet is converted for native, so `first:border-t-0` was silently
        // dead. An explicit index check works on both native and web.
        //
        // Padding matches the design's row box (16px sides, 12px ends → 100px
        // tall), and the divider is full-bleed because the card itself carries no
        // horizontal padding.
        className={cn(
          'flex-row items-center justify-between gap-2 px-4 py-3',
          index > 0 && 'border-t border-white/[0.06]',
        )}
      >
        <View className="flex-1 flex-row items-start gap-3">
          <View className="h-9 w-9 items-center justify-center rounded-[18px] bg-[#2c2c2c]">
            <Text className="text-xs font-medium leading-4 text-white/70">
              {(index + 1).toString().padStart(2, '0')}
            </Text>
          </View>

          <View className="flex-1 gap-[3px]">
            <Text className="text-sm font-medium leading-[18px] text-white" numberOfLines={1}>
              {item.username || 'Invited friend'}
            </Text>
            <Text className="text-xs leading-[14px] text-white/50">
              {formatJoined(item.signupAt)}
            </Text>
            <Text className="text-xs leading-[14px] text-white/50">{spentLine}</Text>

            {presentation.showProgress ? (
              <SpendProgress
                ratio={spendTargetUsd > 0 ? item.spendUsd / spendTargetUsd : 0}
                tone="progress"
              />
            ) : null}

            {/* Bottom row of the details column — the wrapping flex-row keeps the
              pill hugging its label instead of stretching to the column width. */}
            {detailChip ? (
              <View className="flex-row items-start">
                {isPaidWithProof ? (
                  // Tapping the unlocked reward opens the on-chain payout, so
                  // "you were paid" is verifiable rather than just asserted.
                  <Pressable
                    onPress={handleOpenPayout}
                    accessibilityRole="link"
                    accessibilityLabel={`View the ${formatUsdWhole(
                      item.rewardUsd,
                    )} referral payout on the block explorer`}
                    className="flex-row items-center gap-1 web:transition-opacity web:hover:opacity-80"
                  >
                    {detailChip}
                    <ExternalLink size={12} color={REFERRAL_SUCCESS_COLOR} />
                  </Pressable>
                ) : (
                  detailChip
                )}
              </View>
            ) : null}
          </View>
        </View>

        {/* Third column — the lifecycle status, vertically centred. */}
        <Chip tone={presentation.lifecycle.tone} className="shrink-0">
          {presentation.lifecycle.label}
        </Chip>
      </View>
    </Animated.View>
  );
}
