import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { KeyRound } from 'lucide-react-native';

import Loading from '@/components/Loading';
import PageLayout from '@/components/PageLayout';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { path } from '@/constants/path';
import { TRACKING_EVENTS } from '@/constants/tracking-events';
import {
  useLockFuseForTier,
  useSubscribeToTier,
  useTierMembership,
  useTierUpgradeChainState,
} from '@/hooks/useTierMembership';
import { track } from '@/lib/analytics';
import { getTierDisplayName } from '@/lib/tierNames';
import {
  findOffer,
  formatFuse,
  formatLockDuration,
  formatUsd,
  remainingFuseForTier,
  type TierUpgradeRoute,
} from '@/lib/tierUpgrade';
import { RewardsTier } from '@/lib/types';

import TierDetailRow from './TierDetailRow';
import UpgradeTierHeader from './UpgradeTierHeader';

/**
 * The last screen before the signature: exactly what is being committed, and
 * for how long.
 *
 * Separate from the upgrade screen on purpose. Locking FUSE for a year is not
 * reversible by asking nicely, and the term is the part a user is most likely
 * to have skimmed — so it gets a screen where it is one of four lines rather
 * than one row among a price, a balance and a toggle.
 */
export default function UpgradeTierReviewScreen() {
  const { tier: tierParam, route: routeParam } = useLocalSearchParams<{
    tier?: string;
    route?: string;
  }>();
  const { data: membership, isLoading } = useTierMembership();
  const { data: chain } = useTierUpgradeChainState(membership?.contracts);
  const { lockFuse, isLocking, error: lockError } = useLockFuseForTier();
  const { subscribe, isSubscribing, error: subscribeError } = useSubscribeToTier();
  const [failure, setFailure] = useState<string | null>(null);

  const tier = useMemo<RewardsTier | null>(
    () => (tierParam === RewardsTier.PRIME || tierParam === RewardsTier.ULTRA ? tierParam : null),
    [tierParam],
  );
  const route: TierUpgradeRoute = routeParam === 'cash' ? 'cash' : 'lock';
  const offer = tier ? findOffer(membership, tier) : undefined;

  if (isLoading) {
    return (
      <PageLayout scrollable={false} mobileTitle={null} showNavbar={false}>
        <Loading />
      </PageLayout>
    );
  }

  // Reached with a tier that is no longer on offer — a stale deep link, or the
  // route was switched off while the screen was open. Sending them back to the
  // upgrade screen re-derives a real offer rather than signing a stale one.
  if (!membership || !tier || !offer) {
    return (
      <PageLayout scrollable={false} mobileTitle={null} showNavbar={false}>
        <UpgradeTierHeader title="Upgrade tier" />
        <View className="mx-auto w-full max-w-[414px] px-4">
          <Text className="text-center text-[16px] leading-5 text-white/70">
            That upgrade is no longer available.
          </Text>
          <Button
            variant="brand"
            onPress={() => router.replace(path.REWARDS)}
            className="mt-6 h-14 rounded-full"
          >
            <Text className="text-base font-bold text-black">Back to Rewards</Text>
          </Button>
        </View>
      </PageLayout>
    );
  }

  const remainingFuse = remainingFuseForTier(offer, membership.lock.lockedFuse);
  const isPending = isLocking || isSubscribing;
  const message = failure ?? lockError ?? subscribeError;

  const handleUpgrade = async () => {
    setFailure(null);

    try {
      if (route === 'lock') {
        if (!membership.contracts.lockAddress || !membership.contracts.shareTokenAddress) {
          throw new Error('Locking is not available right now.');
        }
        track(TRACKING_EVENTS.TIER_LOCK_PRESSED, { tier, fuse_amount: remainingFuse });

        const result = await lockFuse({
          tier,
          fuseAmount: remainingFuse,
          // The rate read alongside the balances this screen was built from, so
          // the share count matches the FUSE figure the user has just approved.
          rate: chain?.rate ?? 0n,
          lockAddress: membership.contracts.lockAddress,
          shareTokenAddress: membership.contracts.shareTokenAddress,
        });

        // Null is the passkey prompt being dismissed — a decision, not a
        // failure, so the user stays on the screen they chose to leave.
        if (result) router.replace(path.REWARDS);
        return;
      }

      if (!membership.contracts.subscriptionModuleAddress) {
        throw new Error('Memberships are not available right now.');
      }
      // A tier with no price is not sold for cash. The route switch should
      // never have offered this, so reaching it means the offer changed under
      // the user between screens — say so rather than charging them nothing.
      if (offer.annualFeeUsd === null) {
        throw new Error('This tier cannot be bought with an annual fee. Lock soFUSE to hold it.');
      }
      track(TRACKING_EVENTS.TIER_SUBSCRIBE_PRESSED, { tier, price_usd: offer.annualFeeUsd });

      const result = await subscribe({
        tier,
        priceUsd: offer.annualFeeUsd,
        moduleAddress: membership.contracts.subscriptionModuleAddress,
        moduleEnabled: chain?.moduleEnabled ?? false,
      });

      if (result) router.replace(path.REWARDS);
    } catch (error) {
      setFailure(error instanceof Error ? error.message : 'Something went wrong. Try again.');
    }
  };

  return (
    <PageLayout mobileTitle={null} showNavbar={false}>
      <UpgradeTierHeader title="Upgrade tier" />

      <View className="mx-auto w-full max-w-[414px] px-4 pb-10">
        <View className="overflow-hidden rounded-[20px] bg-[#1C1C1C]">
          <TierDetailRow label="Tier" value={getTierDisplayName(tier)} withDivider />

          {route === 'lock' ? (
            <>
              {/* soFUSE in the label, FUSE in the value — the lock takes the
                  Savings position, which is denominated in the FUSE it is
                  worth. Same wording as the row on the screen before this. */}
              <TierDetailRow
                label="soFUSE to lock"
                value={`${formatFuse(remainingFuse)} FUSE`}
                withDivider
              />
              <TierDetailRow
                label="Lock duration"
                value={formatLockDuration(membership.lock.durationDays)}
                withDivider
              />
              <TierDetailRow label="Fee" value="Free" />
            </>
          ) : (
            <>
              <TierDetailRow label="Amount" value={formatUsd(offer.annualFeeUsd)} withDivider />
              <TierDetailRow label="Billed" value="Once a year" withDivider />
              <TierDetailRow label="Fee" value="Free" />
            </>
          )}
        </View>

        <Text className="mt-6 text-center text-[15px] leading-5 text-white/50">
          {route === 'lock'
            ? `Your soFUSE will be unlocked automatically ${formatLockDuration(
                membership.lock.durationDays,
              )} from now, and keeps earning until then.`
            : 'Your membership renews once a year. Cancel any time — you keep the tier to the end of the period you have paid for.'}
        </Text>

        {message ? (
          <Text className="mt-4 text-center text-[14px] leading-5 text-red-400">{message}</Text>
        ) : null}

        <Button
          variant="brand"
          onPress={() => void handleUpgrade()}
          disabled={isPending}
          className="mt-8 h-14 flex-row items-center justify-center gap-2 rounded-full"
        >
          <KeyRound color="black" size={18} strokeWidth={2} />
          <Text className="text-base font-bold text-black">
            {isPending ? 'Upgrading…' : 'Upgrade'}
          </Text>
        </Button>
      </View>
    </PageLayout>
  );
}
