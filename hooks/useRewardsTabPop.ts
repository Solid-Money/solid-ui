import { useEffect, useMemo } from 'react';

import { useCardCredit } from '@/hooks/useCardCredit';
import { useReferralV4Summary } from '@/hooks/useRewards';
import { hasNewReward, rewardMarks } from '@/lib/rewardsSeen';
import { useRewardsSeenStore } from '@/store/useRewardsSeenStore';
import { useUserStore } from '@/store/useUserStore';

/**
 * Calls `onNewReward` when a reward has been credited since the user last saw
 * one — the Rewards tab icon's pop.
 *
 * Reads what the app already loads and never fetches on its own: card credit
 * comes from Home (Wirex cardholders only), the referral summary from the
 * Rewards tab — on native both load at launch, since those tabs mount eagerly.
 *
 * Every reward is marked seen the moment it is noticed, so nothing pops twice:
 * by the pop itself, quietly while the Rewards tab is open (`focused`), and
 * quietly the first time a source loads — a fresh install or an account new to
 * this device never pops for rewards it already had.
 */
export const useRewardsTabPop = (focused: boolean, onNewReward: () => void) => {
  const userId = useUserStore(state => state.users.find(user => user.selected)?.userId);
  const { data: credit } = useCardCredit({ enabled: false });
  const { data: summary } = useReferralV4Summary({ enabled: false });
  const { cardCreditAt, referralCreditAt, spendSharePaidUsd } = useMemo(
    () => rewardMarks(credit, summary),
    [credit, summary],
  );

  useEffect(() => {
    if (!userId) return;
    const marks = { cardCreditAt, referralCreditAt, spendSharePaidUsd };
    const { seenByUserId, acknowledge } = useRewardsSeenStore.getState();
    const isNew = hasNewReward(marks, seenByUserId[userId]);
    acknowledge(userId, marks);
    if (isNew && !focused) onNewReward();
  }, [userId, focused, cardCreditAt, referralCreditAt, spendSharePaidUsd, onNewReward]);
};
