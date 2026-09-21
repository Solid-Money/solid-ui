import { useEffect, useMemo } from 'react';
import { Linking, Pressable, View } from 'react-native';

import Loading from '@/components/Loading';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { DEPOSIT_MODAL } from '@/constants/modals';
import { TRACKING_EVENTS } from '@/constants/tracking-events';
import { useTierBenefits } from '@/hooks/useRewards';
import { useSavingsFundFlow } from '@/hooks/useSavingsFundFlow';
import { useTierMembership, useTierUpgradeChainState } from '@/hooks/useTierMembership';
import { track } from '@/lib/analytics';
import { getTierDisplayName } from '@/lib/tierNames';
import {
  availableRoutes,
  canAffordUpgrade,
  findOffer,
  formatFuse,
  formatFuseHeld,
  formatFuseShortfall,
  formatLockDuration,
  formatMembershipDate,
  formatUsd,
  formatUsdHeld,
  membershipDateLabel,
  nextPurchasableTier,
  remainingFuseForTier,
} from '@/lib/tierUpgrade';
import { RewardsTier } from '@/lib/types';
import { useDepositStore } from '@/store/useDepositStore';
import { useTierUpgradeStore } from '@/store/useTierUpgradeStore';

import TierDetailRow from './TierDetailRow';
import { findTierBenefits, resolveTierUpgradeBenefits } from './tierUpgradeBenefits';
import UpgradeRouteSwitch from './UpgradeRouteSwitch';
import UpgradeTierHeroCard from './UpgradeTierHeroCard';

/** Where "Learn more" and "How to earn points?" send the user. */
export const MEMBERSHIP_HELP_URL =
  'https://support.solid.xyz/en/articles/15613716-solid-rewards-terms-and-conditions';

/**
 * Buying a tier: what it costs by each route, what the user has, and one action.
 *
 * This step does not buy anything itself. Its whole job is to get the user to
 * the point where one press is unambiguous — which is why the CTA is either
 * "Top up" or "Review upgrade" and never both, and why the review is a separate
 * step: committing soFUSE for a year is worth a second look at the term before
 * the passkey prompt.
 *
 * Which tier is being bought is decided before this opens — by the tab on the
 * benefits pager, or by the "Join … Club" card. There is deliberately no tier
 * switch here: two switchers for one choice is two places to read a different
 * answer from, and the benefits pager is the one with the tier's case laid out
 * beside it.
 */
const UpgradeTierContent = () => {
  const { data: membership, isLoading } = useTierMembership();
  const { data: tierBenefits } = useTierBenefits();
  const { data: chain } = useTierUpgradeChainState(membership?.contracts);
  const { selectToken: selectSavingsFundToken } = useSavingsFundFlow();
  const requestedTier = useTierUpgradeStore(state => state.tier);
  const route = useTierUpgradeStore(state => state.route);
  const setRoute = useTierUpgradeStore(state => state.setRoute);
  const review = useTierUpgradeStore(state => state.review);
  const close = useTierUpgradeStore(state => state.close);

  // The tier the opener named, else the cheapest they do not already hold — so
  // an "Upgrade" press from a screen that has no idea which tier it means still
  // lands somewhere useful.
  const tier = requestedTier ?? nextPurchasableTier(membership);

  const offer = tier ? findOffer(membership, tier) : undefined;
  // Memoised because the effect below depends on it: a fresh array every render
  // would re-run the effect every render for no reason.
  const routes = useMemo(() => availableRoutes(offer), [offer]);

  // Settles on a route once the offer is known, and re-settles if the one in
  // hand stops being available — a tier taken off cash sale while the modal is
  // open must not leave a "Cash" tab selected that cannot be completed.
  useEffect(() => {
    if (routes.length === 0) return;
    if (route && routes.includes(route)) return;
    setRoute(routes[0]);
  }, [route, routes, setRoute]);

  useEffect(() => {
    if (tier) track(TRACKING_EVENTS.TIER_UPGRADE_OPENED, { tier });
  }, [tier]);

  if (isLoading) return <Loading />;

  // Nothing to sell: the routes are switched off, or the user already holds
  // everything. Either way this is the wrong thing to be looking at.
  if (!membership?.enabled || !tier || !offer || !route) {
    return (
      <UpgradeUnavailable
        message={
          membership?.currentTier === RewardsTier.ULTRA
            ? 'You are on the highest tier.'
            : 'Tier upgrades are not available right now.'
        }
        onClose={close}
      />
    );
  }

  // Opened on a tier the user already holds — a stale entry point, or one they
  // bought in another tab. Offering it would price an upgrade at nothing and
  // hand the review step zero soFUSE to lock.
  if (offer.held) {
    return (
      <UpgradeUnavailable
        message={`You already hold ${getTierDisplayName(tier)}.`}
        onClose={close}
      />
    );
  }

  const benefits = resolveTierUpgradeBenefits(findTierBenefits(tierBenefits, tier));
  const dateLabel = membershipDateLabel(membership);
  const remainingFuse = remainingFuseForTier(offer, membership.lock.lockedFuse);
  const availableFuse = chain?.fuse ?? 0;
  const availableUsdc = chain?.usdcAmount ?? 0;
  const shortfallFuse = Math.max(0, remainingFuse - availableFuse);

  const affordable = canAffordUpgrade({
    route,
    offer,
    lockedFuse: membership.lock.lockedFuse,
    availableFuse,
    availableUsdc,
  });

  const handleRoute = (next: typeof route) => {
    setRoute(next);
    track(TRACKING_EVENTS.TIER_UPGRADE_ROUTE_SELECTED, { tier, route: next });
  };

  /**
   * Short of what the upgrade costs, so the press has to fix that first.
   *
   * Closes this modal before opening the funding one. Both are dialogs, and a
   * dialog opened over a dialog leaves two overlays and a back gesture that
   * dismisses the wrong one.
   */
  const handleTopUp = () => {
    close();

    const depositStore = useDepositStore.getState();
    depositStore.resetDepositFlow();

    if (route === 'lock') {
      depositStore.setSavingsFundIntent('savings');
      depositStore.setDepositFromSolid(false);
      selectSavingsFundToken('WFUSE');
      return;
    }

    depositStore.setModal(DEPOSIT_MODAL.OPEN_DEPOSIT_TYPE);
  };

  const handleReview = () => {
    track(TRACKING_EVENTS.TIER_UPGRADE_REVIEWED, { tier, route });
    review();
  };

  return (
    <View className="mx-auto w-full max-w-[414px]">
      <UpgradeTierHeroCard
        tier={tier}
        benefits={benefits}
        statusLabel={
          dateLabel && membership.currentTier === tier
            ? `${dateLabel.label} ${formatMembershipDate(dateLabel.date)}`
            : undefined
        }
      />

      <Text className="mb-3 mt-7 text-center text-[16px] leading-5 text-white/50">
        Upgrade tier with
      </Text>

      <UpgradeRouteSwitch routes={routes} selected={route} onSelect={handleRoute} />

      <View className="mt-5 overflow-hidden rounded-[20px] bg-[#1C1C1C]">
        {route === 'cash' ? (
          <>
            <TierDetailRow label="Annual Fee" value={formatUsd(offer.annualFeeUsd)} withDivider />
            <TierDetailRow
              label="Balance"
              value={`${formatUsdHeld(availableUsdc).replace('$', '')} USDC`}
            />
          </>
        ) : (
          <>
            {/* Labelled soFUSE, priced in FUSE. What the lock takes is the
                Savings position — soFUSE shares — while the tier threshold and
                every figure here are denominated in the FUSE those shares are
                worth. Saying only "FUSE" sent people looking for native FUSE in
                their wallet. */}
            <TierDetailRow
              label="soFUSE to lock"
              value={`${formatFuse(remainingFuse)} FUSE`}
              withDivider
            />
            <TierDetailRow
              label="Lock duration"
              value={formatLockDuration(membership.lock.durationDays)}
              onExplain={() => void Linking.openURL(MEMBERSHIP_HELP_URL)}
              withDivider
            />
            <TierDetailRow label="soFUSE balance" value={`${formatFuseHeld(availableFuse)} FUSE`} />
          </>
        )}
      </View>

      <Text className="mt-6 text-center text-[15px] leading-5 text-white/50">
        {route === 'cash'
          ? `Upgrade to the ${offer.tier === RewardsTier.ULTRA ? 'Ultra' : 'Prime'} tier with\nan annual fee. `
          : `Locks soFUSE from your Savings — not native FUSE — for ${formatLockDuration(membership.lock.durationDays)} to hold the tier. It keeps earning while it is locked. `}
        <Text
          accessibilityRole="link"
          onPress={() => void Linking.openURL(MEMBERSHIP_HELP_URL)}
          className="text-[15px] leading-5 text-white underline"
        >
          Learn more
        </Text>
      </Text>

      <Button
        variant="brand"
        onPress={affordable ? handleReview : handleTopUp}
        className="mt-8 h-14 rounded-full"
      >
        <Text className="text-base font-bold text-black">
          {affordable ? 'Review upgrade' : 'Top up'}
        </Text>
      </Button>

      {/* Only when it changes the decision: the user has some FUSE but not
          enough, which "Top up" alone does not describe.

          `shortfallFuse > 0` is what stops the line this screen used to end on
          — "0 FUSE short — add more to Savings" — which appeared whenever the
          gap was under half a unit, told the user nothing, and pointed at a
          top-up of nothing. Affordable hides it outright; a sub-unit gap is
          rounded up to the 1 FUSE that would actually clear it. */}
      {!affordable && route === 'lock' && availableFuse > 0 && shortfallFuse > 0 ? (
        <Pressable
          accessibilityRole="button"
          onPress={handleTopUp}
          className="mt-4 transition-opacity active:opacity-60"
        >
          <Text className="text-center text-[14px] leading-5 text-white/50">
            {formatFuseShortfall(shortfallFuse)} FUSE short — add more to Savings
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
};

/** There is nothing to buy, and saying so beats an empty offer. */
const UpgradeUnavailable = ({ message, onClose }: { message: string; onClose: () => void }) => (
  <View className="mx-auto w-full max-w-[414px]">
    <Text className="text-center text-[16px] leading-5 text-white/70">{message}</Text>
    <Button variant="brand" onPress={onClose} className="mt-6 h-14 rounded-full">
      <Text className="text-base font-bold text-black">Done</Text>
    </Button>
  </View>
);

export default UpgradeTierContent;
