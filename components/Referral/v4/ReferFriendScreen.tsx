import { type ReactNode, useCallback, useEffect, useRef } from 'react';
import { ScrollView, View } from 'react-native';
import { Redirect, router } from 'expo-router';

import PageLayout from '@/components/PageLayout';
import ReferralFriendRow from '@/components/Referral/ReferralFriendRow';
import { Text } from '@/components/ui/text';
import { path } from '@/constants/path';
import { TRACKING_EVENTS } from '@/constants/tracking-events';
import { useReferralSummary, useReferralV4Summary } from '@/hooks/useRewards';
import { track } from '@/lib/analytics';
import {
  bigSpenderStepLine,
  capProgress,
  formatShortDay,
  formatUsdCents,
  formatUsdWhole,
  friendFirstName,
  friendName,
  isReferralV4Live,
  type RewardStepLine,
  spendShareLine,
  upgradeStepLine,
  welcomeStepLine,
} from '@/lib/referral/referralV4';
import { cn } from '@/lib/utils';

import {
  ReferDivider,
  ReferHeader,
  ReferList,
  ReferProgressBar,
  type ReferRewardKind,
  RewardIcon,
} from './ReferV4Primitives';

import type { ReferralV4FriendRow } from '@/lib/types';

const RewardRow = ({
  kind,
  title,
  line,
  amountUsd,
}: {
  kind: ReferRewardKind;
  title: string;
  line: RewardStepLine;
  amountUsd: number;
}) => (
  <View
    className="flex-row items-center gap-3 py-[14px]"
    accessible
    accessibilityLabel={`${title}, ${line.subtitle}, ${formatUsdCents(amountUsd)}`}
  >
    <RewardIcon kind={kind} size={36} />
    <View className="min-w-0 flex-1 gap-[3px]">
      <Text className="text-[15px] font-medium text-white">{title}</Text>
      <Text className="text-[13px] text-white/50">{line.subtitle}</Text>
      {line.progress !== null ? <ReferProgressBar ratio={line.progress} /> : null}
    </View>
    <Text
      className={cn(
        'text-[15px] font-semibold',
        line.amountTone === 'earned' ? 'text-brand' : 'text-white/35',
      )}
    >
      {formatUsdCents(amountUsd)}
    </Text>
  </View>
);

const EarnedHeadline = ({ amount, caption }: { amount: number; caption: string }) => (
  <View className="items-center gap-1">
    <Text className="text-center text-[40px] font-semibold leading-[46px] text-white">
      {formatUsdCents(amount)}
    </Text>
    <Text className="text-center text-[14px] text-white/50">{caption}</Text>
  </View>
);

/** A friend still on today's program: today's row, with today's targets. */
const LegacyFriend = ({ friend }: { friend: ReferralV4FriendRow }) => {
  const { data: legacySummary } = useReferralSummary();
  const legacy = friend.legacy;
  if (!legacy) {
    return (
      <Text className="text-center text-[14px] text-white/50">
        This friend joined before the new program.
      </Text>
    );
  }

  return (
    <View className="gap-3">
      <View className="overflow-hidden rounded-[20px] bg-card">
        <ReferralFriendRow
          item={legacy}
          index={0}
          spendTargetUsd={legacy.spendTargetUsd ?? legacySummary?.qualification.spendTargetUsd ?? 0}
          merchantTarget={legacy.merchantTarget ?? legacySummary?.qualification.merchantTarget ?? 0}
          minMerchantSpendUsd={legacySummary?.qualification.minMerchantSpendUsd}
          activityMinPurchaseUsd={legacySummary?.qualification.activityMinPurchaseUsd ?? null}
        />
      </View>
      <Text className="px-1 text-[13px] leading-[18px] text-white/50">
        Joined before the new program, so this friend earns you {formatUsdWhole(legacy.rewardUsd)}
        {legacy.payoutToken ? ` in ${legacy.payoutToken}` : ''} once they qualify.
      </Text>
    </View>
  );
};

/** One friend's v4 rewards: how far toward the cap, and where each reward stands. */
const V4Friend = ({ friend, children }: { friend: ReferralV4FriendRow; children?: ReactNode }) => (
  <View className="gap-5">
    <View className="gap-2 px-1">
      <ReferProgressBar ratio={capProgress(friend)} />
      <View className="flex-row gap-2">
        <Text className="flex-1 text-[12px] font-medium text-white/60">
          {formatUsdCents(friend.earnedUsd)}
          {friend.onHoldUsd > 0 ? ` · ${formatUsdCents(friend.onHoldUsd)} unlocking` : ''}
        </Text>
        <Text className="text-[12px] font-medium text-white/60">
          Up to {formatUsdWhole(friend.capUsd)}
        </Text>
      </View>
    </View>
    {children}
  </View>
);

/**
 * What one invited friend has earned the user, reward by reward (Figma
 * 29601:13412). A friend from before v4 shows today's row instead.
 */
export default function ReferFriendScreen({ friendId }: { friendId: string | undefined }) {
  const { data: summary, isLoading } = useReferralV4Summary();
  const hasTrackedView = useRef(false);
  const isLive = isReferralV4Live(summary);
  const friend = summary?.friends.find(row => row.referredUserId === friendId);

  useEffect(() => {
    if (!friend || hasTrackedView.current) return;
    hasTrackedView.current = true;
    track(TRACKING_EVENTS.REFERRAL_FRIEND_VIEWED, {
      program: friend.program,
      stage: friend.stage,
    });
  }, [friend]);

  const goBack = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace(path.REFER_INVITES);
  }, []);

  if (isLoading) {
    return (
      <PageLayout desktopOnly isLoading>
        {null}
      </PageLayout>
    );
  }
  if (!summary || !isLive) return <Redirect href={path.REFERRAL_PROGRAM} />;

  let body: ReactNode;
  if (!friend) {
    body = (
      <Text className="pt-10 text-center text-[15px] text-white/60">
        We couldn’t find this friend.
      </Text>
    );
  } else {
    const joined = formatShortDay(friend.joinedAt);
    const caption = `earned from ${friendFirstName(friend.username)}${
      joined ? ` · joined ${joined}` : ''
    }`;
    const { terms } = summary;

    body = (
      <>
        <EarnedHeadline amount={friend.earnedUsd} caption={caption} />
        {friend.program === 'legacy' ? (
          <LegacyFriend friend={friend} />
        ) : (
          <V4Friend friend={friend}>
            <ReferList>
              <RewardRow
                kind="welcome"
                title="Welcome bonus"
                line={welcomeStepLine(friend.welcome, terms)}
                amountUsd={friend.welcome.amountUsd}
              />
              <ReferDivider />
              <RewardRow
                kind="spendShare"
                title="Spend share"
                line={spendShareLine(friend.spendShare, friend.stage)}
                amountUsd={friend.spendShare.earnedUsd}
              />
              <ReferDivider />
              <RewardRow
                kind="upgrade"
                title="Upgrade bonus"
                line={upgradeStepLine(friend.upgrade)}
                amountUsd={friend.upgrade.amountUsd}
              />
              <ReferDivider />
              <RewardRow
                kind="bigSpender"
                title="Big spender bonus"
                line={bigSpenderStepLine(friend.bigSpender, terms)}
                amountUsd={friend.bigSpender.amountUsd}
              />
            </ReferList>
          </V4Friend>
        )}
      </>
    );
  }

  return (
    <PageLayout desktopOnly scrollable={false}>
      <View className="mx-auto w-full max-w-lg flex-1">
        <ReferHeader title={friend ? friendName(friend.username) : undefined} onBack={goBack} />
        <ScrollView
          className="flex-1"
          contentContainerStyle={{
            paddingHorizontal: 16,
            paddingTop: 20,
            paddingBottom: 40,
            gap: 20,
          }}
          showsVerticalScrollIndicator={false}
        >
          {body}
        </ScrollView>
      </View>
    </PageLayout>
  );
}
