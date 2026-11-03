import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { Redirect, router } from 'expo-router';

import PageLayout from '@/components/PageLayout';
import ReferralHeroAnimation from '@/components/Referral/ReferralHeroAnimation';
import { Text } from '@/components/ui/text';
import { path } from '@/constants/path';
import { TRACKING_EVENTS } from '@/constants/tracking-events';
import { useReferralV4Summary } from '@/hooks/useRewards';
import useUser from '@/hooks/useUser';
import { track } from '@/lib/analytics';
import {
  asFriendProgressLine,
  asFriendReversedLine,
  closedNote,
  debtLine,
  formatRate,
  formatUsdCents,
  formatUsdWhole,
  isReferralV4Live,
  isReferralV4Open,
  pausedNote,
  REVERSED_REASON,
} from '@/lib/referral/referralV4';
import { cn } from '@/lib/utils';

import ReferHowItWorksSheet from './ReferHowItWorksSheet';
import ReferRewardSheet from './ReferRewardSheet';
import ReferShareFooter from './ReferShareFooter';
import {
  FriendAvatar,
  ReferHeader,
  ReferIcon,
  ReferNote,
  ReferProgressBar,
  type ReferRewardKind,
  RewardIcon,
} from './ReferV4Primitives';

import type { ReferralV4Summary } from '@/lib/types';

/** The hero avatars at Figma 29615:13405's size: 0.8 of the referral modal's. */
const HERO_SCALE = 0.8;

const Loading = () => (
  <PageLayout desktopOnly isLoading>
    {null}
  </PageLayout>
);

interface TileProps {
  kind: ReferRewardKind;
  label: string;
  value: string;
  caption: string;
  /** Shown once the user has invites: what this reward has paid them so far. */
  earnedUsd: number | null;
  onPress: (kind: ReferRewardKind) => void;
}

/** One of the four reward tiles (Figma "Reward / …"). Tapping opens its sheet. */
const RewardTile = ({ kind, label, value, caption, earnedUsd, onPress }: TileProps) => (
  <Pressable
    onPress={() => onPress(kind)}
    accessibilityRole="button"
    accessibilityLabel={`${label}: ${value} ${caption}`}
    className="flex-1 gap-3 overflow-hidden rounded-[22px] bg-card p-4 active:opacity-80 web:hover:bg-card-hover"
  >
    <View className="flex-row items-center gap-1.5">
      <RewardIcon kind={kind} size={20} />
      <Text className="flex-1 text-[12px] font-medium text-white/70" numberOfLines={1}>
        {label}
      </Text>
    </View>
    <View className="gap-0.5">
      <Text className="text-[20px] font-semibold leading-[24px] text-white">{value}</Text>
      <Text className="text-[12px] leading-[16px] text-white/50">{caption}</Text>
    </View>
    {earnedUsd !== null ? (
      <Text
        className={cn('text-[12px] font-medium', earnedUsd > 0 ? 'text-brand' : 'text-white/40')}
      >
        Earned {formatUsdCents(earnedUsd)}
      </Text>
    ) : null}
  </Pressable>
);

/** This month and lifetime, side by side. */
const TotalsCard = ({ summary }: { summary: ReferralV4Summary }) => (
  <View className="flex-row items-center overflow-hidden rounded-[20px] bg-card p-4">
    <View className="flex-1 items-center gap-0.5">
      <Text className="text-center text-[13px] text-white/50">This month</Text>
      <Text className="text-center text-[16px] font-semibold text-white">
        {formatUsdCents(summary.totals.thisMonthUsd)}
      </Text>
    </View>
    <View className="h-8 w-px bg-white/[0.08]" />
    <View className="flex-1 items-center gap-0.5">
      <Text className="text-center text-[13px] text-white/50">Total</Text>
      <Text className="text-center text-[16px] font-semibold text-white">
        {formatUsdCents(summary.totals.earnedUsd)}
      </Text>
    </View>
  </View>
);

/** The way into "Your invites": the first three friends' initials, stacked. */
const InvitesRow = ({ summary }: { summary: ReferralV4Summary }) => {
  const invited = summary.counts.invited || summary.friends.length;
  const earning = summary.counts.earning;
  return (
    <Pressable
      onPress={() => router.push(path.REFER_INVITES)}
      accessibilityRole="button"
      accessibilityLabel={`Your invites: ${invited} friends, ${earning} earning`}
      className="flex-row items-center gap-3 overflow-hidden rounded-[20px] bg-card px-4 py-[14px] active:opacity-80 web:hover:bg-card-hover"
    >
      <View className="flex-row">
        {summary.friends.slice(0, 3).map((friend, index) => (
          <FriendAvatar
            key={friend.referredUserId}
            username={friend.username}
            size={32}
            ringed
            style={
              index < Math.min(3, summary.friends.length) - 1 ? { marginRight: -10 } : undefined
            }
          />
        ))}
      </View>
      <View className="min-w-0 flex-1 gap-0.5">
        <Text className="text-[15px] font-medium text-white">Your invites</Text>
        <Text className="text-[13px] text-white/50">
          {invited} {invited === 1 ? 'friend' : 'friends'} · {earning} earning
        </Text>
      </View>
      <ReferIcon asset="images/referral-v4/chevron.svg" size={14} />
    </Pressable>
  );
};

/**
 * The user's own invite: while their welcome credit is still to earn, or once
 * one of their bonuses was reversed.
 */
const AsFriendCard = ({ summary }: { summary: ReferralV4Summary }) => {
  const line = asFriendProgressLine(summary.asFriend, summary.terms);
  const reversed = line ? null : asFriendReversedLine(summary.asFriend);
  if (!summary.asFriend || (!line && !reversed)) return null;
  const { welcome } = summary.asFriend;
  const target = welcome.targetUsd ?? summary.terms.welcome.spendTargetUsd;

  return (
    <View className="mx-4 mt-5 flex-row gap-3 overflow-hidden rounded-[20px] bg-card p-4">
      <RewardIcon kind={reversed?.step ?? 'welcome'} size={36} />
      <View className="min-w-0 flex-1 gap-1">
        <Text className="text-[13px] text-white/50">
          {summary.asFriend.referrerUsername} invited you
        </Text>
        {reversed ? (
          <>
            <Text className="text-[15px] leading-[20px] text-white/60">{reversed.text}</Text>
            <Text className="text-[13px] leading-[18px] text-white/40">{REVERSED_REASON}</Text>
          </>
        ) : (
          <Text className="text-[15px] leading-[20px] text-white">{line}</Text>
        )}
        {!reversed && welcome.status === 'in_progress' && target > 0 ? (
          <ReferProgressBar ratio={(welcome.progressUsd ?? 0) / target} className="mt-1" />
        ) : null}
      </View>
    </View>
  );
};

/**
 * Refer & Earn, referral program v4 (Figma 29591:13199 without invites,
 * 29601:13223 with). Only reachable while the program is live: anything else —
 * the program switched off, the summary failing — goes back to today's
 * referral popup, so a backend that is not there yet changes nothing.
 */
export default function ReferScreen() {
  const { user } = useUser();
  const { data: summary, isLoading } = useReferralV4Summary();
  const [rewardSheet, setRewardSheet] = useState<ReferRewardKind | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const hasTrackedView = useRef(false);

  const isLive = isReferralV4Live(summary);
  const hasInvites = (summary?.friends.length ?? 0) > 0;

  useEffect(() => {
    if (!isLive || hasTrackedView.current) return;
    hasTrackedView.current = true;
    track(TRACKING_EVENTS.REFERRAL_SCREEN_VIEWED, { program: 'v4', hasInvites });
  }, [isLive, hasInvites]);

  const openReward = useCallback((kind: ReferRewardKind) => {
    setRewardSheet(kind);
    track(TRACKING_EVENTS.REFERRAL_REWARD_SHEET_OPENED, { reward: kind });
  }, []);

  const goBack = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace(path.REWARDS);
  }, []);

  if (isLoading) return <Loading />;
  if (!summary || !isLive) return <Redirect href={path.REFERRAL_PROGRAM} />;

  const { terms, rewards } = summary;
  const code = summary.referralCode || user?.referralCode || '';
  const earned = (amount: number) => (hasInvites ? amount : null);
  const closed = closedNote(summary);
  const paused = pausedNote(terms);
  const debt = debtLine(summary.debt);

  return (
    <PageLayout desktopOnly scrollable={false}>
      <View className="mx-auto w-full max-w-lg flex-1">
        <ReferHeader onBack={goBack} />

        <ScrollView
          className="flex-1"
          contentContainerStyle={{ paddingBottom: 24 }}
          showsVerticalScrollIndicator={false}
        >
          {hasInvites ? (
            <View className="items-center px-8 pb-1.5 pt-4">
              <Text className="text-center text-[30px] font-semibold leading-[34px] text-white">
                Earn up to {formatUsdWhole(terms.spendShare.capPerFriendUsd)}
                {'\n'}for every friend
              </Text>
            </View>
          ) : (
            <View className="items-center px-8 pt-2">
              {/* The avatars' glow reaches ~9pt past the drawing, so the gap to
                  the title is the design's 24 less that. */}
              <ReferralHeroAnimation isActive scale={HERO_SCALE} />
              <Text className="mt-[15px] text-center text-[30px] font-semibold leading-[34px] text-white">
                Earn up to {formatUsdWhole(terms.spendShare.capPerFriendUsd)}
                {'\n'}for every friend
              </Text>
              <Text className="mt-3 text-center text-[15px] leading-[21px] text-white/55">
                They get {formatUsdWhole(terms.welcome.friendUsd)} to spend with their card.
              </Text>
            </View>
          )}

          <AsFriendCard summary={summary} />

          <View className="gap-3 px-4 pt-7">
            <View className="flex-row items-center gap-1 px-1">
              <Text className="flex-1 text-[14px] font-medium text-white/50">How you earn</Text>
              <Pressable
                onPress={() => setIsDetailsOpen(true)}
                accessibilityRole="button"
                accessibilityLabel="Terms"
                hitSlop={8}
                className="flex-row items-center gap-1 active:opacity-70 web:hover:opacity-80"
              >
                <Text className="text-[14px] font-medium text-white/50">Terms</Text>
                <ReferIcon asset="images/referral-v4/chevron.svg" size={14} />
              </Pressable>
            </View>

            <View className="flex-row gap-3">
              <RewardTile
                kind="spendShare"
                label="Spend share"
                value={formatRate(terms.spendShare.rate)}
                caption="of their spend"
                earnedUsd={earned(rewards.spendShare.earnedUsd)}
                onPress={openReward}
              />
              <RewardTile
                kind="welcome"
                label="Welcome bonus"
                value={
                  terms.welcome.referrerUsd === terms.welcome.friendUsd
                    ? `${formatUsdWhole(terms.welcome.referrerUsd)} each`
                    : formatUsdWhole(terms.welcome.referrerUsd)
                }
                caption={`at ${formatUsdWhole(terms.welcome.spendTargetUsd)} spend`}
                earnedUsd={earned(rewards.welcome.earnedUsd)}
                onPress={openReward}
              />
            </View>
            <View className="flex-row gap-3">
              <RewardTile
                kind="bigSpender"
                label="Big spender bonus"
                value={
                  terms.bigSpender.referrerUsd === terms.bigSpender.friendUsd
                    ? `${formatUsdWhole(terms.bigSpender.referrerUsd)} each`
                    : formatUsdWhole(terms.bigSpender.referrerUsd)
                }
                caption={`at ${formatUsdWhole(terms.bigSpender.spendTargetUsd)} spend`}
                earnedUsd={earned(rewards.bigSpender.earnedUsd)}
                onPress={openReward}
              />
              <RewardTile
                kind="upgrade"
                label="Upgrade bonus"
                value={`${formatUsdWhole(terms.upgrade.primeUsd)}–${formatUsdWhole(
                  terms.upgrade.ultraUsd,
                )}`}
                caption="for Prime or Ultra"
                earnedUsd={earned(rewards.upgrade.earnedUsd)}
                onPress={openReward}
              />
            </View>

            <TotalsCard summary={summary} />
            {closed ? <ReferNote>{closed}</ReferNote> : null}
            {paused ? <ReferNote>{paused}</ReferNote> : null}
            {debt ? <ReferNote>{debt}</ReferNote> : null}
            {hasInvites ? <InvitesRow summary={summary} /> : null}
          </View>
        </ScrollView>

        {code ? (
          <ReferShareFooter
            code={code}
            // Closed to new invites: a friend who joins now is not offered v4's credit.
            friendCreditUsd={isReferralV4Open(summary) ? terms.welcome.friendUsd : undefined}
            surface="refer"
          />
        ) : null}
      </View>

      <ReferRewardSheet kind={rewardSheet} onClose={() => setRewardSheet(null)} summary={summary} />
      <ReferHowItWorksSheet
        isOpen={isDetailsOpen}
        onOpenChange={setIsDetailsOpen}
        summary={summary}
      />
    </PageLayout>
  );
}
