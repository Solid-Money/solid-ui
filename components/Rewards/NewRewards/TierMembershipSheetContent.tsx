import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';

import TierStar from '@/components/Rewards/NewRewards/TierHero/TierStar';
import TierDetailRow from '@/components/Rewards/NewRewards/UpgradeTier/TierDetailRow';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { useCancelTierSubscription, useTierMembership } from '@/hooks/useTierMembership';
import { getAsset } from '@/lib/assets';
import { getTierDisplayName } from '@/lib/tierNames';
import {
  formatFuse,
  formatMembershipDate,
  formatMembershipDay,
  formatUsd,
  membershipDateLabel,
} from '@/lib/tierUpgrade';
import { RewardsTier, TierSubscriptionStatus } from '@/lib/types';

const GLOW_ASSET = 'images/rewards-tiers/glow.svg' as const;
const GLOW_SIZE = 260;
const STAR_SIZE = 150;

interface TierMembershipSheetContentProps {
  onClose: () => void;
  topPadding?: number;
}

/**
 * What the user's membership actually is: which tier, since when, and what is
 * holding it up.
 *
 * Opened by tapping the tier anywhere it is shown, and deliberately readable
 * rather than promotional — this is the screen someone comes to when they want
 * to know when their soFUSE comes back or when they will next be charged, so
 * every line is a fact with a date on it.
 */
const TierMembershipSheetContent = ({
  onClose,
  topPadding = 12,
}: TierMembershipSheetContentProps) => {
  const { data: membership } = useTierMembership();
  const { mutateAsync: cancelSubscription, isPending: isCancelling } = useCancelTierSubscription();
  const [isConfirmingCancel, setIsConfirmingCancel] = useState(false);

  const tier = membership?.currentTier ?? RewardsTier.CORE;
  const subscription = membership?.subscription ?? null;
  const lock = membership?.lock;
  const dateLabel = membershipDateLabel(membership);

  // A membership already set to end has nothing left to cancel, and neither has
  // one that has run out — offering the action there would be offering to do
  // something that has already happened.
  const canCancel =
    subscription !== null &&
    !subscription.cancelAtPeriodEnd &&
    subscription.status !== TierSubscriptionStatus.EXPIRED &&
    subscription.status !== TierSubscriptionStatus.CANCELLED;

  return (
    <View className="px-5 pb-8" style={{ paddingTop: topPadding }}>
      <View className="items-center justify-center" style={{ height: STAR_SIZE }}>
        <Image
          source={getAsset(GLOW_ASSET)}
          contentFit="contain"
          style={[styles.glow, { width: GLOW_SIZE, height: GLOW_SIZE }]}
          pointerEvents="none"
        />
        <TierStar tier={tier} size={STAR_SIZE} />
      </View>

      <View className="mt-4 flex-row items-center justify-center gap-1.5">
        <TierStar tier={tier} size={16} />
        <Text className="text-[14px] leading-4 text-white/70">{getTierDisplayName(tier)}</Text>
      </View>

      <Text className="mt-2 text-center text-[28px] font-semibold leading-8 text-white">
        Tier membership
      </Text>

      <View className="mt-6 overflow-hidden rounded-[20px] bg-[#232323]">
        <TierDetailRow label="Current tier" value={getTierDisplayName(tier)} withDivider />
        <TierDetailRow
          label="Member since"
          value={formatMembershipDay(membership?.memberSince) || '—'}
        />
      </View>

      {lock && lock.lockedFuse > 0 ? (
        <View className="mt-4 overflow-hidden rounded-[20px] bg-[#232323]">
          {/* soFUSE is what the lock holds; FUSE is what it is worth. Both are
              on the row for the same reason the upgrade screen carries both. */}
          <TierDetailRow
            label="Locked soFUSE"
            value={`${formatFuse(lock.lockedFuse)} FUSE`}
            withDivider
          />
          <TierDetailRow
            label="Unlock date"
            value={
              lock.nextUnlockAt
                ? formatMembershipDay(lock.nextUnlockAt)
                : lock.maturedFuse > 0
                  ? 'Unlocking now'
                  : '—'
            }
          />
        </View>
      ) : null}

      {subscription ? (
        <View className="mt-4 overflow-hidden rounded-[20px] bg-[#232323]">
          <TierDetailRow
            label="Annual fee"
            value={formatUsd(Number(subscription.priceUsd))}
            withDivider={Boolean(dateLabel)}
          />
          {dateLabel ? (
            <TierDetailRow label={dateLabel.label} value={formatMembershipDate(dateLabel.date)} />
          ) : null}
        </View>
      ) : null}

      {/* The cancel path is two presses, not a dialog: the sheet is already a
          modal, and stacking another over it to ask one question is a worse
          answer than asking it here. */}
      {canCancel ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            if (isConfirmingCancel) void cancelSubscription(undefined);
            else setIsConfirmingCancel(true);
          }}
          disabled={isCancelling}
          hitSlop={8}
          className="mt-5 transition-opacity active:opacity-60"
        >
          <Text className="text-center text-[14px] leading-5 text-white/50">
            {isCancelling
              ? 'Cancelling…'
              : isConfirmingCancel
                ? `Tap again to stop renewing — you keep ${getTierDisplayName(tier)} until ${formatMembershipDate(subscription?.currentPeriodEnd)}`
                : 'Cancel membership'}
          </Text>
        </Pressable>
      ) : null}

      <Button variant="brand" onPress={onClose} className="mt-6 h-14 rounded-full">
        <Text className="text-base font-bold text-black">Close</Text>
      </Button>
    </View>
  );
};

const styles = StyleSheet.create({
  glow: {
    opacity: 0.35,
    position: 'absolute',
  },
});

export default TierMembershipSheetContent;
