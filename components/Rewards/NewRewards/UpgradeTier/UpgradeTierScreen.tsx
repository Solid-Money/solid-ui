import { useEffect, useMemo, useState } from 'react';
import { Linking, Pressable, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';

import Loading from '@/components/Loading';
import PageLayout from '@/components/PageLayout';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { path } from '@/constants/path';
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
  formatLockDuration,
  formatMembershipDate,
  formatUsd,
  membershipDateLabel,
  nextPurchasableTier,
  remainingFuseForTier,
  type TierUpgradeRoute,
} from '@/lib/tierUpgrade';
import { RewardsTier } from '@/lib/types';
import { useDepositStore } from '@/store/useDepositStore';

import TierDetailRow from './TierDetailRow';
import { findTierBenefits, resolveTierUpgradeBenefits } from './tierUpgradeBenefits';
import UpgradeRouteSwitch from './UpgradeRouteSwitch';
import UpgradeTierHeader from './UpgradeTierHeader';
import UpgradeTierHeroCard from './UpgradeTierHeroCard';

/** Where "Learn more" and "How to earn points?" send the user. */
const MEMBERSHIP_HELP_URL = 'https://docs.solid.money/rewards/tiers';

/**
 * Buying a tier: what it costs by each route, what the user has, and one action.
 *
 * The screen does not buy anything itself. Its whole job is to get the user to
 * the point where one press is unambiguous — which is why the CTA is either
 * "Top up" or "Review upgrade" and never both, and why the review step is a
 * separate screen: committing FUSE for a year is worth a second look at the
 * term before the passkey prompt.
 */
export default function UpgradeTierScreen() {
  const { tier: tierParam } = useLocalSearchParams<{ tier?: string }>();
  const { data: membership, isLoading } = useTierMembership();
  const { data: tierBenefits } = useTierBenefits();
  const { data: chain } = useTierUpgradeChainState(membership?.contracts);
  const { selectToken: selectSavingsFundToken } = useSavingsFundFlow();

  // The tier from the deep link when it names one, else the cheapest the user
  // does not already hold — so "Upgrade" from anywhere lands somewhere useful.
  const tier = useMemo<RewardsTier | null>(() => {
    if (tierParam === RewardsTier.PRIME || tierParam === RewardsTier.ULTRA) return tierParam;
    return nextPurchasableTier(membership);
  }, [membership, tierParam]);

  const offer = tier ? findOffer(membership, tier) : undefined;
  // Memoised because the effect below depends on it: a fresh array every render
  // would re-run the effect every render for no reason.
  const routes = useMemo(() => availableRoutes(offer), [offer]);
  const [route, setRoute] = useState<TierUpgradeRoute | null>(null);

  // Settles on a route once the offer is known, and re-settles if the one in
  // hand stops being available — a tier taken off cash sale while the screen is
  // open must not leave a "Cash" tab selected that cannot be completed.
  useEffect(() => {
    if (routes.length === 0) return;
    if (route && routes.includes(route)) return;
    setRoute(routes[0]);
  }, [route, routes]);

  useEffect(() => {
    if (tier) track(TRACKING_EVENTS.TIER_UPGRADE_OPENED, { tier });
  }, [tier]);

  if (isLoading) {
    return (
      <PageLayout scrollable={false} mobileTitle={null} showNavbar={false}>
        <Loading />
      </PageLayout>
    );
  }

  // Nothing to sell: the routes are switched off, or the user already holds
  // everything. Either way an upgrade screen is the wrong thing to be looking
  // at, so it hands back to Rewards rather than rendering an empty offer.
  if (!membership?.enabled || !tier || !offer || !route) {
    return (
      <PageLayout scrollable={false} mobileTitle={null} showNavbar={false}>
        <UpgradeTierHeader title="Upgrade tier" />
        <View className="mx-auto w-full max-w-[414px] px-4">
          <Text className="text-center text-[16px] leading-5 text-white/70">
            {membership?.currentTier === RewardsTier.ULTRA
              ? 'You are on the highest tier.'
              : 'Tier upgrades are not available right now.'}
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

  // A deep link can name a tier the user already holds. Offering it would price
  // an upgrade at nothing and hand the review screen zero FUSE to lock, so the
  // honest answer is that there is nothing to buy.
  if (offer.held) {
    return (
      <PageLayout scrollable={false} mobileTitle={null} showNavbar={false}>
        <UpgradeTierHeader title="Upgrade tier" />
        <View className="mx-auto w-full max-w-[414px] px-4">
          <Text className="text-center text-[16px] leading-5 text-white/70">
            You already hold {getTierDisplayName(tier)}.
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

  const benefits = resolveTierUpgradeBenefits(findTierBenefits(tierBenefits, tier));
  const dateLabel = membershipDateLabel(membership);
  const remainingFuse = remainingFuseForTier(offer, membership.lock.lockedFuse);
  const availableFuse = chain?.fuse ?? 0;
  const availableUsdc = chain?.usdcAmount ?? 0;

  const affordable = canAffordUpgrade({
    route,
    offer,
    lockedFuse: membership.lock.lockedFuse,
    availableFuse,
    availableUsdc,
  });

  const handleRoute = (next: TierUpgradeRoute) => {
    setRoute(next);
    track(TRACKING_EVENTS.TIER_UPGRADE_ROUTE_SELECTED, { tier, route: next });
  };

  /**
   * Short of what the upgrade costs, so the press has to fix that first.
   *
   * Each route tops up in its own currency and through the flow that already
   * exists for it: FUSE through the savings funding flow, USDC through deposit.
   */
  const handleTopUp = () => {
    const depositStore = useDepositStore.getState();
    depositStore.resetDepositFlow();

    if (route === 'lock') {
      depositStore.setSavingsFundIntent('savings');
      depositStore.setDepositFromSolid(false);
      selectSavingsFundToken('WFUSE');
      return;
    }

    router.push(path.DEPOSIT);
  };

  const handleReview = () => {
    track(TRACKING_EVENTS.TIER_UPGRADE_REVIEWED, { tier, route });
    router.push({
      pathname: '/rewards/upgrade-review',
      params: { tier, route },
    } as never);
  };

  return (
    <PageLayout mobileTitle={null} showNavbar={false}>
      <UpgradeTierHeader title="Upgrade tier" />

      <View className="mx-auto w-full max-w-[414px] px-4 pb-10">
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
                value={`${formatUsd(availableUsdc).replace('$', '')} USDC`}
              />
            </>
          ) : (
            <>
              <TierDetailRow
                label="Fuse amount"
                value={`${formatFuse(remainingFuse)} FUSE`}
                withDivider
              />
              <TierDetailRow
                label="Lock duration"
                value={formatLockDuration(membership.lock.durationDays)}
                onExplain={() => void Linking.openURL(MEMBERSHIP_HELP_URL)}
                withDivider
              />
              <TierDetailRow label="Balance" value={`${formatFuse(availableFuse)} FUSE`} />
            </>
          )}
        </View>

        <Text className="mt-6 text-center text-[15px] leading-5 text-white/50">
          {route === 'cash'
            ? `Upgrade to the ${offer.tier === RewardsTier.ULTRA ? 'Ultra' : 'Prime'} tier with an annual fee. `
            : `Lock FUSE for ${formatLockDuration(membership.lock.durationDays)} to hold the tier — it keeps earning while it is locked. `}
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

        {/* Only ever shown when it changes the decision: the user has the money
            but it is in the wrong place, which "Top up" does not describe. */}
        {!affordable && route === 'lock' && availableFuse > 0 ? (
          <Pressable
            accessibilityRole="button"
            onPress={handleTopUp}
            className="mt-4 transition-opacity active:opacity-60"
          >
            <Text className="text-center text-[14px] leading-5 text-white/50">
              {formatFuse(remainingFuse - availableFuse)} FUSE short — add more to Savings
            </Text>
          </Pressable>
        ) : null}
      </View>
    </PageLayout>
  );
}
