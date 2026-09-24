import { useEffect, useMemo } from 'react';
import { Linking, Pressable, View } from 'react-native';
import { formatUnits } from 'viem';
import { fuse } from 'viem/chains';

import Loading from '@/components/Loading';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { WalletTokenButton } from '@/components/WalletTokenSelector';
import { DEPOSIT_MODAL } from '@/constants/modals';
import { TRACKING_EVENTS } from '@/constants/tracking-events';
import { useMaxAPY } from '@/hooks/useAnalytics';
import { useNativePriceUsd } from '@/hooks/useNativePriceUsd';
import { useTierBenefits } from '@/hooks/useRewards';
import { useTierMembership, useTierUpgradeChainState } from '@/hooks/useTierMembership';
import { track } from '@/lib/analytics';
import { lockTokenRow } from '@/lib/lockTokenRows';
import {
  availableLockAssets,
  canPayLockWith,
  lockPaymentBalance,
  resolveLockAsset,
} from '@/lib/tierLockPayment';
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
import { RewardsTier, VaultType } from '@/lib/types';
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
  const { maxAPY: fuseSavingsApy } = useMaxAPY(VaultType.FUSE);
  const requestedTier = useTierUpgradeStore(state => state.tier);
  const route = useTierUpgradeStore(state => state.route);
  const fusePriceUsd = useNativePriceUsd(fuse.id, 'fusePriceUsd', route === 'lock');
  const setRoute = useTierUpgradeStore(state => state.setRoute);
  const review = useTierUpgradeStore(state => state.review);
  const selectToken = useTierUpgradeStore(state => state.selectToken);
  const chosenAsset = useTierUpgradeStore(state => state.lockAsset);
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
  const availableUsdc = chain?.usdcAmount ?? 0;

  /**
   * Everything the lock could be paid from, all of it priced in FUSE.
   *
   * soFUSE goes through the vault's rate; native FUSE and WFUSE do not, because
   * the wrapper holds exactly its own total supply and one WFUSE is one FUSE.
   */
  const balances = {
    sofuse: chain?.fuse ?? 0,
    native: chain?.nativeFuse ?? 0,
    wrapped: chain?.wrappedFuse ?? 0,
  };
  // FUSE and WFUSE are only payable because the zap deposits and locks in one
  // transaction. Without it the only thing that can be locked is Savings, and
  // the picker collapses to that one row.
  const zapAvailable = Boolean(membership.contracts.lockZapAddress);
  const paymentAsset = resolveLockAsset(chosenAsset, zapAvailable);
  const paymentBalanceFuse = lockPaymentBalance(paymentAsset, balances);
  // soFUSE is a yield-bearing share token. Its FUSE value decides affordability,
  // but a row named "Balance" must show the number of tokens the user holds.
  const paymentTokenBalance =
    paymentAsset === 'soFUSE' ? Number(formatUnits(chain?.shares ?? 0n, 18)) : paymentBalanceFuse;
  // Built by the same helper the picker's rows come from, so the chip here and
  // the row the user tapped there cannot disagree about a ticker or an icon.
  // No price: this chip has no dollar column to fill.
  const paymentToken = lockTokenRow({
    asset: paymentAsset,
    balances,
    chainId: membership.contracts.chainId,
    addresses: membership.contracts,
  });
  // Measured against the token that is actually paying, which is the one the
  // row above the shortfall names.
  const shortfallFuse = Math.max(0, remainingFuse - paymentBalanceFuse);

  const affordable =
    route === 'cash'
      ? canAffordUpgrade({
          route,
          offer,
          lockedFuse: membership.lock.lockedFuse,
          availableFuse: balances.sofuse,
          availableUsdc,
        })
      : canPayLockWith(paymentAsset, remainingFuse, balances);

  const handleRoute = (next: typeof route) => {
    setRoute(next);
    track(TRACKING_EVENTS.TIER_UPGRADE_ROUTE_SELECTED, { tier, route: next });
  };

  /**
   * Short of what the upgrade costs, so the press has to fix that first.
   *
   * Which flow depends on which balance is short, and the two are not
   * interchangeable: the savings direct deposit mints share tokens, while the
   * "Add funds" sheet funds the wallet, where a token stays the token that was
   * sent. Sending a user short of native FUSE to the savings flow would hand
   * them more soFUSE and leave the row they were looking at unmoved, with
   * nothing on screen explaining why.
   *
   * Closes this modal before opening the funding one. Both are dialogs, and a
   * dialog opened over a dialog leaves two overlays and a back gesture that
   * dismisses the wrong one.
   */
  const handleTopUp = () => {
    const depositToSavings = route === 'lock' && paymentAsset === 'soFUSE';
    close();

    // The upgrade modal's native exit animation takes 180ms. Opening a second
    // portal during that same render can leave Android with a black surface.
    // Let the first dialog finish leaving before mounting the deposit flow.
    setTimeout(() => {
      const depositStore = useDepositStore.getState();
      depositStore.resetDepositFlow();
      // A cash upgrade is paid in USDC; buying FUSE would not fill that balance.
      if (route === 'lock') depositStore.setUpgradeTopUp({ tier, depositToSavings });
      depositStore.setModal(DEPOSIT_MODAL.OPEN_DEPOSIT_TYPE);
    }, 200);
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
            : route === 'cash'
              ? 'Renews annually'
              : undefined
        }
      />

      {tier !== RewardsTier.ULTRA && (
        <>
          <Text className="mb-3 mt-7 text-center text-[16px] leading-5 text-white/70">
            Upgrade tier with
          </Text>

          <UpgradeRouteSwitch routes={routes} selected={route} onSelect={handleRoute} />
        </>
      )}

      <View className="mt-5 overflow-hidden rounded-[20px] bg-[#1C1C1C]">
        {route === 'cash' ? (
          <>
            <TierDetailRow label="Annual Fee" value={formatUsd(offer.annualFeeUsd)} withDivider />
            <TierDetailRow
              label="Your balance"
              value={`${formatUsdHeld(availableUsdc).replace('$', '')} USDC`}
            />
          </>
        ) : (
          <>
            {/* The token comes first because it decides every number under
                it — which balance the cost is checked against, the shortfall,
                and the calls the Safe signs.

                Static when there is only one token on offer, which is what
                this shows while the zap is not deployed: a picker with one row
                is a label, and a chevron that opens nothing is a promise the
                screen cannot keep. */}
            <TierDetailRow label="Upgrade with" withDivider>
              <WalletTokenButton
                selectedToken={paymentToken}
                onPress={selectToken}
                disabled={availableLockAssets(zapAvailable).length < 2}
                showChainName={false}
                tickerFontSize={16}
              />
            </TierDetailRow>
            <TierDetailRow
              label="Amount"
              value={`${formatFuse(remainingFuse)} FUSE`}
              secondaryValue={
                fusePriceUsd > 0 ? formatUsd(remainingFuse * fusePriceUsd) : undefined
              }
              withDivider
            />
            <TierDetailRow
              label="FUSE APY"
              value={fuseSavingsApy > 0 ? `${fuseSavingsApy.toFixed(1)}%` : '—'}
              valueClassName="text-[#94F27F]"
              tooltip="The FUSE Savings APY is based on recent vault performance and can change. It does not include a tier yield boost."
              tooltipAnalyticsContext="tier_upgrade_fuse_apy"
              withDivider
            />
            <TierDetailRow
              label="Lock duration"
              value={formatLockDuration(membership.lock.durationDays)}
              tooltip={`Your FUSE stays in Savings and keeps earning while locked for ${formatLockDuration(membership.lock.durationDays)}. It unlocks automatically when the term ends.`}
              tooltipAnalyticsContext="tier_upgrade_lock_duration"
              withDivider
            />
            {/* Keep the balance next to the funding action: the CTA below flips
                between "Review upgrade" and "Top up" based on this amount. */}
            <TierDetailRow
              label="Your balance"
              value={`${formatFuseHeld(paymentTokenBalance)} ${paymentAsset}`}
              secondaryValue={
                paymentAsset === 'soFUSE'
                  ? `≈ ${formatFuseHeld(paymentBalanceFuse)} FUSE`
                  : undefined
              }
            />
          </>
        )}
      </View>

      <Text className="mt-6 text-center text-[15px] leading-5 text-white/50">
        {route === 'cash'
          ? `Upgrade to the ${offer.tier === RewardsTier.ULTRA ? 'Ultra' : 'Prime'} tier with\nan annual fee. `
          : paymentAsset === 'soFUSE'
            ? `Locks the FUSE already in your Savings for ${formatLockDuration(membership.lock.durationDays)} to hold the tier. It keeps earning while it is locked. `
            : `Deposits your ${paymentAsset} into Savings and locks it for ${formatLockDuration(membership.lock.durationDays)} to hold the tier, in one transaction. It keeps earning while it is locked. `}
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
      {!affordable && route === 'lock' && paymentBalanceFuse > 0 && shortfallFuse > 0 ? (
        <Pressable
          accessibilityRole="button"
          onPress={handleTopUp}
          className="mt-4 transition-opacity active:opacity-60"
        >
          <Text className="text-center text-[14px] leading-5 text-white/50">
            {formatFuseShortfall(shortfallFuse)} {paymentAsset} short — top up or pick another token
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
