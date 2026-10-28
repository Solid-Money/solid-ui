import { type ReactNode } from 'react';
import { View } from 'react-native';

import { Text } from '@/components/ui/text';
import {
  formatRate,
  formatShortDay,
  formatUsdShort,
  formatUsdWhole,
  friendName,
} from '@/lib/referral/referralV4';
import { cn } from '@/lib/utils';

import ReferSheet from './ReferSheet';
import {
  FriendAvatar,
  ReferAmountChip,
  ReferDivider,
  type ReferRewardKind,
  ReferTermsLink,
  RewardIcon,
} from './ReferV4Primitives';

import type {
  ReferralV4RewardEvent,
  ReferralV4RewardStatus,
  ReferralV4Summary,
  ReferralV4Terms,
} from '@/lib/types';

/** A sheet only grows to its content on native, so a long list stops here. */
const MAX_FRIEND_ROWS = 5;

const TITLES: Record<ReferRewardKind, string> = {
  spendShare: 'Spend share',
  welcome: 'Welcome bonus',
  bigSpender: 'Big spender bonus',
  upgrade: 'Upgrade bonus',
};

/** "$10 each" when both sides get the same, "$10" for the referrer otherwise. */
const eachLabel = (referrerUsd: number, friendUsd: number) =>
  referrerUsd === friendUsd ? `${formatUsdWhole(referrerUsd)} each` : formatUsdWhole(referrerUsd);

/** The chip and the paragraph, worded from the live terms. */
export const rewardCopy = (
  kind: ReferRewardKind,
  terms: ReferralV4Terms,
): { chip: string; description: string } => {
  switch (kind) {
    case 'spendShare':
      return {
        chip: `${formatRate(terms.spendShare.rate)} of spend`,
        description: `Get ${formatRate(
          terms.spendShare.rate,
        )} of everything your friend spends with their card. Paid every Thursday, up to ${formatUsdWhole(
          terms.spendShare.capPerFriendUsd,
        )} per friend.`,
      };
    case 'welcome': {
      const { referrerUsd, friendUsd, spendTargetUsd, merchantTarget, windowDays } = terms.welcome;
      const who =
        referrerUsd === friendUsd
          ? `You and your friend each get ${formatUsdWhole(referrerUsd)}`
          : `You get ${formatUsdWhole(referrerUsd)} and your friend gets ${formatUsdWhole(friendUsd)}`;
      return {
        chip: eachLabel(referrerUsd, friendUsd),
        description: `${who} of card credit when they spend ${formatUsdWhole(spendTargetUsd)}${
          merchantTarget > 0 ? ` at ${merchantTarget} or more shops` : ''
        } in their first ${windowDays} days.`,
      };
    }
    case 'bigSpender': {
      const { referrerUsd, friendUsd, spendTargetUsd, windowDays } = terms.bigSpender;
      const who =
        referrerUsd === friendUsd
          ? `You and your friend each get ${formatUsdWhole(referrerUsd)}`
          : `You get ${formatUsdWhole(referrerUsd)} and your friend gets ${formatUsdWhole(friendUsd)}`;
      return {
        chip: eachLabel(referrerUsd, friendUsd),
        description: `${who} of card credit when they spend ${formatUsdWhole(
          spendTargetUsd,
        )} in their first ${windowDays} days.`,
      };
    }
    case 'upgrade':
      return {
        chip: `${formatUsdWhole(terms.upgrade.primeUsd)} or ${formatUsdWhole(terms.upgrade.ultraUsd)}`,
        description: `Get ${formatUsdWhole(
          terms.upgrade.primeUsd,
        )} of card credit when your friend gets Prime, or ${formatUsdWhole(
          terms.upgrade.ultraUsd,
        )} when they get Ultra.`,
      };
  }
};

const BOOST_STEP: Partial<Record<ReferRewardKind, 'welcome' | 'big_spender' | 'upgrade'>> = {
  welcome: 'welcome',
  bigSpender: 'big_spender',
  upgrade: 'upgrade',
};

/** "2× credit until Nov 5" while a boost covers this reward on the referrer's side. */
const boostLine = (kind: ReferRewardKind, terms: ReferralV4Terms): string | null => {
  const boost = terms.boost;
  const step = BOOST_STEP[kind];
  if (!boost || !step || !boost.steps.includes(step) || boost.sides === 'friend') return null;
  if (Date.parse(boost.endsAt) <= Date.now()) return null;
  return `${boost.multiplier}× credit until ${formatShortDay(boost.endsAt)}`;
};

/** What each event's status means for the row's second line. */
const eventSubtitle = (event: ReferralV4RewardEvent): string => {
  const statusLabels: Partial<Record<ReferralV4RewardStatus, string>> = {
    on_hold: event.unlocksAt ? `Unlocks ${formatShortDay(event.unlocksAt)}` : 'Unlocking',
    limit_reached: 'Waiting on your bonus limit',
    under_review: 'In review',
    cancelled: 'Cancelled',
  };
  return statusLabels[event.status] ?? formatShortDay(event.creditedAt ?? event.earnedAt);
};

interface FriendRowData {
  key: string;
  username: string;
  subtitle: string;
  amount: string;
  isEarned: boolean;
}

const FriendEarningRow = ({ row }: { row: FriendRowData }) => (
  <View className="flex-row items-center gap-3 py-[11px]">
    <FriendAvatar username={row.username} size={32} />
    <View className="min-w-0 flex-1 gap-px">
      <Text className="text-[14px] font-medium text-white" numberOfLines={1}>
        {friendName(row.username)}
      </Text>
      <Text className="text-[12px] text-white/50" numberOfLines={1}>
        {row.subtitle}
      </Text>
    </View>
    <Text
      className={cn('text-[14px] font-semibold', row.isEarned ? 'text-brand' : 'text-white/35')}
    >
      {row.amount}
    </Text>
  </View>
);

const friendRows = (kind: ReferRewardKind, summary: ReferralV4Summary): FriendRowData[] => {
  if (kind === 'spendShare') {
    // Spend share has no one-off events: list the friends it has come from.
    return summary.friends
      .filter(friend => friend.program === 'v4' && friend.spendShare.earnedUsd > 0)
      .map(friend => ({
        key: friend.referredUserId,
        username: friend.username,
        subtitle:
          friend.spendShare.thisWeekUsd > 0
            ? `+${formatUsdShort(friend.spendShare.thisWeekUsd)} this week`
            : 'Paid Thursdays',
        amount: `+${formatUsdShort(friend.spendShare.earnedUsd)}`,
        isEarned: true,
      }));
  }

  return summary.rewards[kind].events.map((event, index) => ({
    key: `${event.referredUserId}-${event.earnedAt}-${index}`,
    username: event.username,
    subtitle: eventSubtitle(event),
    amount: `+${formatUsdShort(event.amountUsd)}`,
    isEarned: event.status === 'credited' || event.status === 'paid',
  }));
};

interface ReferRewardSheetProps {
  kind: ReferRewardKind | null;
  onClose: () => void;
  summary: ReferralV4Summary;
}

/**
 * One reward explained (Figma 29591:13291 / 13396 / 13499 / 13602), with the
 * friends who have earned it for the user (29602:13259) or the empty state.
 */
const ReferRewardSheet = ({ kind, onClose, summary }: ReferRewardSheetProps) => {
  // The last kind stays rendered while the sheet animates closed.
  const shown: ReferRewardKind = kind ?? 'welcome';
  const { chip, description } = rewardCopy(shown, summary.terms);
  const boost = boostLine(shown, summary.terms);
  const rows = friendRows(shown, summary);
  const visible = rows.slice(0, MAX_FRIEND_ROWS);
  const hidden = rows.length - visible.length;

  let list: ReactNode;
  if (rows.length === 0) {
    list = (
      <View className="w-full items-center gap-1 rounded-[22px] bg-white/[0.05] p-5">
        <Text className="text-center text-[15px] font-medium text-white">No friends yet</Text>
        <Text className="text-center text-[13px] text-white/50">
          Friends who earn you this will show up here.
        </Text>
      </View>
    );
  } else {
    list = (
      <View className="w-full rounded-[20px] bg-white/[0.05] px-4 py-1">
        {visible.map((row, index) => (
          <View key={row.key}>
            {index > 0 ? <ReferDivider /> : null}
            <FriendEarningRow row={row} />
          </View>
        ))}
        {hidden > 0 ? (
          <>
            <ReferDivider />
            <Text className="py-3 text-center text-[13px] text-white/50">
              and {hidden} more {hidden === 1 ? 'friend' : 'friends'}
            </Text>
          </>
        ) : null}
      </View>
    );
  }

  return (
    <ReferSheet
      isOpen={kind !== null}
      onOpenChange={open => {
        if (!open) onClose();
      }}
      contentKey="referral-v4-reward"
    >
      <RewardIcon kind={shown} size={56} />
      <Text className="mt-[14px] text-center text-[22px] font-semibold text-white">
        {TITLES[shown]}
      </Text>
      <View className="mt-[10px]">
        <ReferAmountChip label={chip} />
      </View>
      {boost ? <Text className="mt-2 text-[13px] font-medium text-brand">{boost}</Text> : null}
      <Text className="mt-3 text-center text-[15px] leading-[21px] text-white/60">
        {description}
      </Text>
      <View className="mt-[22px] w-full">{list}</View>
      <View className="mt-4">
        <ReferTermsLink />
      </View>
    </ReferSheet>
  );
};

export default ReferRewardSheet;
