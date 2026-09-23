import { RewardsTier, TierMembershipState, TierOffer, TierSubscriptionStatus } from '@/lib/types';

/** soFUSE shares and the accountant rate are both 18-decimal. */
const SHARE_DECIMALS = 18n;
const ONE_SHARE = 10n ** SHARE_DECIMALS;

/** The two routes to a tier. */
export type TierUpgradeRoute = 'cash' | 'lock';

/**
 * An amount of FUSE as wei, without going through a float multiplication.
 *
 * `amount * 1e18` is past `Number.MAX_SAFE_INTEGER` for anything above ~9 FUSE,
 * and the rounding it silently does goes **down** — which is the one direction
 * the share maths must never go. Going via the decimal string keeps it exact
 * for the whole-FUSE thresholds the tiers are priced in.
 */
const toFuseWei = (amount: number): bigint => {
  const [whole, fraction = ''] = amount.toFixed(18).split('.');
  return BigInt(whole) * ONE_SHARE + BigInt(fraction.padEnd(18, '0'));
};

/**
 * The share count that is worth at least `fuseAmount` at `rate`.
 *
 * Rounded **up**, deliberately. The tier threshold is measured in FUSE and the
 * contract values a position as `shares * rate / 1e18`, flooring it — so the
 * exact quotient can come back a wei short and buy nothing. One extra share unit
 * is a rounding error to the user and the difference between a tier and no tier.
 *
 * Returns 0 rather than throwing on a rate of 0: an unreadable rate is a screen
 * that cannot offer the lock yet, not a crash.
 */
export const fuseSharesForAmount = (fuseAmount: number, rate: bigint): bigint => {
  if (!Number.isFinite(fuseAmount) || fuseAmount <= 0 || rate <= 0n) return 0n;

  const fuseWei = toFuseWei(fuseAmount);

  return (fuseWei * ONE_SHARE + rate - 1n) / rate;
};

/**
 * A share count valued in FUSE, the way the lock contract values it.
 *
 * Divided down to six decimal places *before* becoming a number: 5e22 is well
 * past the precision a double carries, so converting first and dividing after
 * reports 50,000 FUSE as 49,999.99999999999.
 */
export const fuseForShares = (shares: bigint, rate: bigint): number => {
  if (shares <= 0n || rate <= 0n) return 0;

  const DISPLAY_SCALE = 1_000_000n;
  return Number((shares * rate) / (ONE_SHARE * (ONE_SHARE / DISPLAY_SCALE))) / 1e6;
};

/**
 * The FUSE a user still has to commit to reach a tier.
 *
 * What is already locked counts, so topping up from Prime to Ultra asks for the
 * difference rather than for the whole thing again.
 */
export const remainingFuseForTier = (offer: TierOffer, lockedFuse: number): number =>
  Math.max(0, offer.lockFuse - Math.max(0, lockedFuse));

/** The routes a tier can actually be bought by right now, cheapest intent first. */
export const availableRoutes = (offer: TierOffer | undefined): TierUpgradeRoute[] => {
  if (!offer) return [];

  const routes: TierUpgradeRoute[] = [];
  if (offer.cashAvailable) routes.push('cash');
  if (offer.lockAvailable) routes.push('lock');

  return routes;
};

/**
 * Whether the user can complete the upgrade now, or has to top up first.
 *
 * This is what decides between the two CTAs in the design — "Top up" and
 * "Upgrade" — so it is one function rather than a condition written twice.
 */
export const canAffordUpgrade = ({
  route,
  offer,
  lockedFuse,
  availableFuse,
  availableUsdc,
}: {
  route: TierUpgradeRoute;
  offer: TierOffer;
  lockedFuse: number;
  /** Unlocked soFUSE the Safe holds, in FUSE. */
  availableFuse: number;
  /** USDC the Safe holds. */
  availableUsdc: number;
}): boolean =>
  route === 'cash'
    ? offer.annualFeeUsd > 0 && availableUsdc >= offer.annualFeeUsd
    : availableFuse >= remainingFuseForTier(offer, lockedFuse);

/** The offer for one tier, or undefined when it is not sold. */
export const findOffer = (
  membership: TierMembershipState | undefined,
  tier: RewardsTier,
): TierOffer | undefined => membership?.offers.find(offer => offer.tier === tier);

/**
 * The tier the upgrade screen should open on.
 *
 * The cheapest tier the user does not already hold, so someone on Core is
 * offered Prime and someone on Prime is offered Ultra. `null` once they hold
 * everything, which is what hides the entry point rather than offering an
 * upgrade to a tier they are already on.
 */
export const nextPurchasableTier = (
  membership: TierMembershipState | undefined,
): RewardsTier | null => {
  const next = membership?.offers.find(
    offer => !offer.held && (offer.lockAvailable || offer.cashAvailable),
  );

  return next?.tier ?? null;
};

/**
 * What a membership's next date means, in the words the app uses for it.
 *
 * Four different dates live on one membership and they are not interchangeable:
 * a renewal, a scheduled end, a grace deadline. Resolving them in one place is
 * what keeps the upgrade screen's pill and the membership sheet from describing
 * the same membership differently.
 */
export const membershipDateLabel = (
  membership: TierMembershipState | undefined,
): { label: string; date: string } | null => {
  const subscription = membership?.subscription;
  if (!subscription) return null;

  if (subscription.status === TierSubscriptionStatus.PAST_DUE && subscription.graceEndsAt) {
    return { label: 'Payment due by', date: subscription.graceEndsAt };
  }

  if (subscription.cancelAtPeriodEnd || subscription.status === TierSubscriptionStatus.CANCELLED) {
    return { label: 'Ends on', date: subscription.currentPeriodEnd };
  }

  if (subscription.status === TierSubscriptionStatus.EXPIRED) return null;

  return { label: 'Renews on', date: subscription.nextChargeAt ?? subscription.currentPeriodEnd };
};

/**
 * Month names, spelled out rather than left to `toLocaleDateString`.
 *
 * The design says "Sep"; recent ICU says "Sept", and Hermes, JSC and V8 do not
 * all ship the same ICU — so the same membership would be dated differently on
 * iOS, Android and web. A table is three lines and cannot drift.
 */
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** A date as the design writes it in a pill: "10 Sep, 2027". */
export const formatMembershipDate = (iso: string | null | undefined): string => {
  if (!iso) return '';

  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';

  return `${date.getDate()} ${MONTHS[date.getMonth()]}, ${date.getFullYear()}`;
};

/** A date as the membership sheet writes it: "Sep 14, 2026". */
export const formatMembershipDay = (iso: string | null | undefined): string => {
  if (!iso) return '';

  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';

  return `${MONTHS[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
};

/** A whole number of FUSE, grouped: "50,000". */
export const formatFuse = (amount: number): string =>
  amount.toLocaleString('en-US', { maximumFractionDigits: 0 });

/** A USD figure with cents: "$199.00". */
export const formatUsd = (amount: number): string =>
  `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** A lock term in the words the design uses: "12 months". */
export const formatLockDuration = (days: number): string => {
  if (days <= 0) return '';

  const months = Math.round(days / 30.4375);
  if (months >= 12 && months % 12 === 0) {
    const years = months / 12;
    return years === 1 ? '12 months' : `${years} years`;
  }

  return months <= 1 ? `${days} days` : `${months} months`;
};
