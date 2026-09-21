import { useState } from 'react';
import { View } from 'react-native';
import { KeyRound } from 'lucide-react-native';

import Loading from '@/components/Loading';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { TRACKING_EVENTS } from '@/constants/tracking-events';
import {
  useLockFuseForTier,
  useSubscribeToTier,
  useTierMembership,
  useTierUpgradeChainState,
} from '@/hooks/useTierMembership';
import { track } from '@/lib/analytics';
import {
  canPayLockWith,
  LOCK_PAYMENT_LABEL,
  type LockPaymentBalances,
  resolveLockAsset,
} from '@/lib/tierLockPayment';
import { getTierDisplayName } from '@/lib/tierNames';
import {
  canAffordUpgrade,
  findOffer,
  formatFuse,
  formatLockDuration,
  formatUsd,
  remainingFuseForTier,
} from '@/lib/tierUpgrade';
import { useTierUpgradeStore } from '@/store/useTierUpgradeStore';

import TierDetailRow from './TierDetailRow';

/**
 * The last step before the signature: exactly what is being committed, and for
 * how long.
 *
 * Separate from the offer step on purpose. Locking FUSE for a year is not
 * reversible by asking nicely, and the term is the part a user is most likely
 * to have skimmed — so it gets a step where it is one of four lines rather than
 * one row among a price, a balance and a toggle.
 */
const UpgradeReviewContent = () => {
  const { data: membership, isLoading } = useTierMembership();
  const { data: chain } = useTierUpgradeChainState(membership?.contracts);
  const { lockFuse, isLocking, error: lockError } = useLockFuseForTier();
  const { subscribe, isSubscribing, error: subscribeError } = useSubscribeToTier();
  const [failure, setFailure] = useState<string | null>(null);

  const tier = useTierUpgradeStore(state => state.tier);
  const route = useTierUpgradeStore(state => state.route) ?? 'lock';
  const chosenAsset = useTierUpgradeStore(state => state.lockAsset);
  const back = useTierUpgradeStore(state => state.back);
  const close = useTierUpgradeStore(state => state.close);

  const offer = tier ? findOffer(membership, tier) : undefined;

  if (isLoading) return <Loading />;

  // Reached with a tier that is no longer on offer — bought in another tab, or
  // the route was switched off while the modal was open. Sending them back to
  // the offer step re-derives a real offer rather than signing a stale one.
  if (!membership || !tier || !offer) {
    return (
      <View className="mx-auto w-full max-w-[414px]">
        <Text className="text-center text-[16px] leading-5 text-white/70">
          That upgrade is no longer available.
        </Text>
        <Button variant="brand" onPress={back} className="mt-6 h-14 rounded-full">
          <Text className="text-base font-bold text-black">Back</Text>
        </Button>
      </View>
    );
  }

  const remainingFuse = remainingFuseForTier(offer, membership.lock.lockedFuse);
  const isPending = isLocking || isSubscribing;
  const message = failure ?? lockError ?? subscribeError;

  /**
   * The token the user picked, re-checked against what is still on offer.
   *
   * Not re-decided here: the step before this named a token and priced the
   * upgrade against that balance, and quietly signing a different one would
   * spend a balance the user was keeping. `resolveLockAsset` only steps in when
   * the choice has become impossible — the zap switched off between steps —
   * where the alternative is a transaction that can only revert.
   */
  const paymentAsset = resolveLockAsset(chosenAsset, Boolean(membership.contracts.lockZapAddress));

  /**
   * Re-checked here rather than trusted from the step before.
   *
   * The balances are polled every few seconds and the user may have been
   * reading the term for a while — a concurrent spend from another tab or
   * device is enough to make the offer step's answer stale, and the only thing
   * downstream of a wrong answer is an on-chain revert.
   *
   * `chain === undefined` is "the balances have not loaded", which blocks the
   * button without claiming the user is short: saying so while the balance is
   * still being read would be wrong about half the time.
   */
  const balances: LockPaymentBalances | undefined = chain
    ? { sofuse: chain.fuse, native: chain.nativeFuse, wrapped: chain.wrappedFuse }
    : undefined;

  // The cash route has the same hole and closes it the same way: the offer step
  // checked the USDC balance, and that check is minutes old by the time anyone
  // presses this.
  const canPay =
    chain !== undefined &&
    balances !== undefined &&
    (route === 'lock'
      ? canPayLockWith(paymentAsset, remainingFuse, balances)
      : canAffordUpgrade({
          route,
          offer,
          lockedFuse: membership.lock.lockedFuse,
          availableFuse: chain.fuse,
          availableUsdc: chain.usdcAmount,
        }));

  // Only once we have actually read the balances. Nothing to say while they load.
  const shortOfFunds = chain !== undefined && !canPay;

  const handleUpgrade = async () => {
    setFailure(null);

    try {
      if (route === 'lock') {
        if (!membership.contracts.lockAddress || !membership.contracts.shareTokenAddress) {
          throw new Error('Locking is not available right now.');
        }
        track(TRACKING_EVENTS.TIER_LOCK_PRESSED, { tier, fuse_amount: remainingFuse });

        // The button is disabled while this is false, but the balances move
        // under it on a poll — and the only thing downstream of a stale yes is
        // a revert the user pays gas for.
        if (!balances || !canPayLockWith(paymentAsset, remainingFuse, balances)) {
          throw new Error(
            `Your ${LOCK_PAYMENT_LABEL[paymentAsset]} balance no longer covers this upgrade.`,
          );
        }

        const result = await lockFuse({
          tier,
          asset: paymentAsset,
          fuseAmount: remainingFuse,
          // The rate read alongside the balances this step was built from, so
          // the share count matches the FUSE figure the user has just approved.
          rate: chain?.rate ?? 0n,
          lockAddress: membership.contracts.lockAddress,
          shareTokenAddress: membership.contracts.shareTokenAddress,
          zapAddress: membership.contracts.lockZapAddress,
          wrappedNativeAddress: membership.contracts.wrappedNativeAddress,
        });

        // Null is the passkey prompt being dismissed — a decision, not a
        // failure, so the modal stays where the user left it.
        if (result) close();
        return;
      }

      if (!membership.contracts.subscriptionModuleAddress) {
        throw new Error('Memberships are not available right now.');
      }
      // A tier with no price is not sold for cash. The route switch should
      // never have offered this, so reaching it means the offer changed under
      // the user between steps — say so rather than charging them nothing.
      if (offer.annualFeeUsd === null) {
        throw new Error('This tier cannot be bought with an annual fee. Lock FUSE to hold it.');
      }
      track(TRACKING_EVENTS.TIER_SUBSCRIBE_PRESSED, { tier, price_usd: offer.annualFeeUsd });

      const result = await subscribe({
        tier,
        priceUsd: offer.annualFeeUsd,
        moduleAddress: membership.contracts.subscriptionModuleAddress,
        moduleEnabled: chain?.moduleEnabled ?? false,
      });

      if (result) close();
    } catch (error) {
      setFailure(error instanceof Error ? error.message : 'Something went wrong. Try again.');
    }
  };

  return (
    <View className="mx-auto w-full max-w-[414px]">
      <View className="overflow-hidden rounded-[20px] bg-[#1C1C1C]">
        <TierDetailRow label="Tier" value={getTierDisplayName(tier)} withDivider />

        {route === 'lock' ? (
          <>
            {/* The token first, as on the step before: the last screen before
                the signature has to say which balance this comes out of, and
                it is the line the rest of the rows are priced against. */}
            <TierDetailRow
              label="Paying with"
              value={LOCK_PAYMENT_LABEL[paymentAsset]}
              withDivider
            />
            {/* Priced in FUSE whichever token pays: the tier's threshold is a
                FUSE figure, and soFUSE is quoted at the FUSE it is worth. */}
            <TierDetailRow
              label="Amount to lock"
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
          ? `${
              paymentAsset === 'soFUSE'
                ? 'Your FUSE in Savings is locked.'
                : `Your ${LOCK_PAYMENT_LABEL[paymentAsset]} is moved into Savings and locked, in one transaction.`
            } It unlocks automatically ${formatLockDuration(
              membership.lock.durationDays,
            )} from now, and keeps earning until then.`
          : 'Your membership renews once a year. Cancel any time — you keep the tier to the end of the period you have paid for.'}
      </Text>

      {message ? (
        <Text className="mt-4 text-center text-[14px] leading-5 text-red-400">{message}</Text>
      ) : shortOfFunds ? (
        <Text className="mt-4 text-center text-[14px] leading-5 text-white/50">
          {route === 'lock'
            ? `Your ${LOCK_PAYMENT_LABEL[paymentAsset]} balance no longer covers this upgrade. Go back to top up or pick another token.`
            : 'Your balance no longer covers this upgrade. Go back to top up.'}
        </Text>
      ) : null}

      <Button
        variant="brand"
        onPress={() => void handleUpgrade()}
        disabled={isPending || !canPay}
        className="mt-8 h-14 flex-row items-center justify-center gap-2 rounded-full"
      >
        <KeyRound color="black" size={18} strokeWidth={2} />
        <Text className="text-base font-bold text-black">
          {isPending ? 'Upgrading…' : 'Upgrade'}
        </Text>
      </Button>
    </View>
  );
};

export default UpgradeReviewContent;
