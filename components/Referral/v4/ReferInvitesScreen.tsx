import { useCallback, useEffect, useRef } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { Redirect, router } from 'expo-router';

import PageLayout from '@/components/PageLayout';
import { Text } from '@/components/ui/text';
import { path, referFriendPath } from '@/constants/path';
import { TRACKING_EVENTS } from '@/constants/tracking-events';
import { useReferralV4Summary } from '@/hooks/useRewards';
import useUser from '@/hooks/useUser';
import { track } from '@/lib/analytics';
import {
  formatPayoutDay,
  formatUsdCents,
  friendName,
  friendStatusLine,
  isReferralV4Live,
} from '@/lib/referral/referralV4';
import { cn } from '@/lib/utils';

import ReferShareFooter from './ReferShareFooter';
import { FriendAvatar, ReferDivider, ReferHeader, ReferList } from './ReferV4Primitives';

import type { ReferralV4FriendRow, ReferralV4Terms } from '@/lib/types';

const FriendRow = ({
  friend,
  terms,
  onPress,
}: {
  friend: ReferralV4FriendRow;
  terms: ReferralV4Terms;
  onPress: (friend: ReferralV4FriendRow) => void;
}) => {
  const status = friendStatusLine(friend, terms);
  // Credited and paid to the user from this friend; a legacy row's paid reward.
  const earned = friend.earnedUsd ?? 0;
  const name = friendName(friend.username);

  return (
    <Pressable
      onPress={() => onPress(friend)}
      accessibilityRole="button"
      accessibilityLabel={`${name}, ${status.text}, ${formatUsdCents(earned)} earned`}
      className="flex-row items-center gap-3 py-3 active:opacity-70 web:hover:opacity-80"
    >
      <FriendAvatar username={friend.username} size={40} />
      <View className="min-w-0 flex-1 gap-0.5">
        <Text className="text-[15px] font-medium text-white" numberOfLines={1}>
          {name}
        </Text>
        {/* Two lines: a reversed bonus says why. */}
        <Text
          className={cn('text-[13px]', status.tone === 'accent' ? 'text-brand' : 'text-white/50')}
          numberOfLines={2}
        >
          {status.text}
        </Text>
      </View>
      <Text
        className={cn('text-[15px] font-semibold', earned > 0 ? 'text-white' : 'text-white/35')}
      >
        {formatUsdCents(earned)}
      </Text>
    </Pressable>
  );
};

/**
 * Every friend the user has invited and what each one has earned them (Figma
 * 29601:13329): the total, this month and the next payout, then one row per
 * friend with what they are doing right now.
 */
export default function ReferInvitesScreen() {
  const { user } = useUser();
  const { data: summary, isLoading } = useReferralV4Summary();
  const hasTrackedView = useRef(false);
  const isLive = isReferralV4Live(summary);
  const friendCount = summary?.friends.length ?? 0;

  useEffect(() => {
    if (!isLive || hasTrackedView.current) return;
    hasTrackedView.current = true;
    track(TRACKING_EVENTS.REFERRAL_INVITES_VIEWED, { count: friendCount });
  }, [isLive, friendCount]);

  const goBack = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace(path.REFER);
  }, []);

  const openFriend = useCallback((friend: ReferralV4FriendRow) => {
    router.push(referFriendPath(friend.referredUserId));
  }, []);

  if (isLoading) {
    return (
      <PageLayout desktopOnly isLoading>
        {null}
      </PageLayout>
    );
  }
  if (!summary || !isLive) return <Redirect href={path.REFERRAL_PROGRAM} />;

  const { totals, terms } = summary;
  const code = summary.referralCode || user?.referralCode || '';
  const invited = summary.counts.invited || friendCount;

  return (
    <PageLayout desktopOnly scrollable={false}>
      <View className="mx-auto w-full max-w-lg flex-1">
        <ReferHeader title="Your invites" onBack={goBack} />

        <ScrollView
          className="flex-1"
          contentContainerStyle={{
            paddingHorizontal: 16,
            paddingTop: 20,
            paddingBottom: 24,
            gap: 20,
          }}
          showsVerticalScrollIndicator={false}
        >
          <View className="items-center gap-1">
            <Text className="text-center text-[40px] font-semibold leading-[46px] text-white">
              {formatUsdCents(totals.earnedUsd)}
            </Text>
            <Text className="text-center text-[14px] text-white/50">
              earned from {invited} {invited === 1 ? 'friend' : 'friends'}
            </Text>
            {totals.onHoldUsd > 0 ? (
              <Text className="text-center text-[13px] text-white/40">
                {formatUsdCents(totals.onHoldUsd)} unlocking
              </Text>
            ) : null}
          </View>

          <View className="flex-row gap-3 overflow-hidden rounded-[20px] bg-card px-[18px] py-[14px]">
            <View className="flex-1 gap-0.5">
              <Text className="text-[13px] text-white/50">This month</Text>
              <Text className="text-[16px] font-semibold text-white">
                {formatUsdCents(totals.thisMonthUsd)}
              </Text>
            </View>
            <View className="flex-1 gap-0.5">
              <Text className="text-[13px] text-white/50">Next payout</Text>
              {/* No date while payouts are switched off: there is no next one yet. */}
              <Text className="text-[16px] font-semibold text-white">
                {terms.paused ? 'Paused' : formatPayoutDay(totals.nextPayoutAt) || '—'}
              </Text>
            </View>
          </View>

          {friendCount > 0 ? (
            <ReferList>
              {summary.friends.map((friend, index) => (
                <View key={friend.referredUserId || `${friend.joinedAt}-${index}`}>
                  {index > 0 ? <ReferDivider /> : null}
                  <FriendRow friend={friend} terms={terms} onPress={openFriend} />
                </View>
              ))}
            </ReferList>
          ) : (
            <View className="items-center gap-1 rounded-[20px] bg-card p-5">
              <Text className="text-center text-[15px] font-medium text-white">No invites yet</Text>
              <Text className="text-center text-[13px] text-white/50">
                Friends who join with your link will show up here.
              </Text>
            </View>
          )}
        </ScrollView>

        {code ? (
          <ReferShareFooter
            code={code}
            friendCreditUsd={terms.welcome.friendUsd}
            surface="invites"
          />
        ) : null}
      </View>
    </PageLayout>
  );
}
