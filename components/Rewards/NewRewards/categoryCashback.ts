import { RewardsTier, type SubscriptionCategoryRate } from '@/lib/types';

/**
 * The categories this app ships artwork and copy for.
 *
 * This is NOT the list the sheet renders — that comes from the API, so a
 * category added, renamed or re-priced in the admin portal reaches the app
 * without a release. This is only the design fallback for a backend too old to
 * send `subscriptionCategoryRates` at all, and the key space the local artwork
 * maps are written against.
 */
export const DESIGN_CATEGORIES = [
  { key: 'ai', label: 'AI' },
  { key: 'streaming', label: 'Streaming' },
  { key: 'music', label: 'Music' },
  { key: 'rides', label: 'Rides' },
  { key: 'airlines', label: 'Airlines' },
] as const;

/**
 * A category this app has artwork for.
 *
 * Deliberately narrower than the keys the API may send: logos cannot be
 * invented for a category nobody has drawn, so the artwork maps are keyed by
 * this while everything else works in plain strings.
 */
export type CashbackCategoryKey = (typeof DESIGN_CATEGORIES)[number]['key'];

/**
 * One category as a surface paints it: whatever the API called it, and what
 * the tier in question earns on it in percentage points. A rate of 0 is the
 * locked state that sells an upgrade, not an absent category — a category the
 * admin paused is simply not in the list.
 */
export interface CashbackCategory {
  key: string;
  label: string;
  rate: number;
}

/**
 * Rates the backend used to have no way of expressing.
 *
 * Reached only on a backend that does not send `subscriptionCategoryRates`;
 * once it does, every category, label and rate on every surface comes from the
 * API. These are the v4 Figma values.
 */
const FALLBACK_RATES: Record<RewardsTier, Record<CashbackCategoryKey, number>> = {
  [RewardsTier.CORE]: { ai: 0, streaming: 0, music: 0, rides: 0, airlines: 0 },
  [RewardsTier.PRIME]: { ai: 10, streaming: 10, music: 10, rides: 8, airlines: 0 },
  [RewardsTier.ULTRA]: { ai: 20, streaming: 20, music: 20, rides: 10, airlines: 10 },
};

/** The headline the Core sheet advertises: the best rate any tier reaches. */
const CORE_HEADLINE_RATE = Math.max(...Object.values(FALLBACK_RATES[RewardsTier.ULTRA]));

const usableRate = (rate: number | undefined): number =>
  typeof rate === 'number' && Number.isFinite(rate) && rate > 0 ? rate : 0;

/**
 * A cashback percentage as every surface prints it: 3 → "3%", 2.5 → "2.5%",
 * 3.0000000000000004 → "3%".
 *
 * Lives here, in the module with no imports of its own, so the cashback
 * receipt and the tier comparison page can both reach it without either
 * importing the other.
 */
export const formatCashbackRate = (percentage: number): string =>
  `${Number(percentage.toFixed(2))}%`;

/** Whether this app has artwork for a category the API sent. */
export const hasCategoryArtwork = (key: string): key is CashbackCategoryKey =>
  DESIGN_CATEGORIES.some(category => category.key === key);

/**
 * The categories to render, in the order the API sends them.
 *
 * The API is the whole truth once it speaks: its list is what is on offer, its
 * labels are what to print, and its rates are what is paid. A category added in
 * the admin portal shows up here on its own; one an admin paused is absent and
 * is not painted; one this app has no artwork for still gets a row, just
 * without logos — dropping it would be this list quietly disagreeing with what
 * the backend actually pays.
 *
 * Only a backend too old to send the list at all falls back to the design
 * table, where the flat `subscriptionDiscountRate` covers the subscription
 * categories and Rides and Airlines keep their design values.
 */
const resolveCategories = (
  tier: RewardsTier,
  categoryRates: SubscriptionCategoryRate[] | undefined,
  subscriptionDiscountRate: number,
): CashbackCategory[] => {
  if (categoryRates?.length) {
    return categoryRates
      .filter(entry => entry && typeof entry.key === 'string' && !!entry.key)
      .map(entry => ({
        key: entry.key,
        // A backend that sends no label still gets a readable row rather than a
        // blank one; the key is the closest thing to a name we have.
        label: entry.label || entry.key,
        rate: usableRate(entry.rate),
      }));
  }

  const fallback = FALLBACK_RATES[tier] ?? FALLBACK_RATES[RewardsTier.CORE];
  const flat = usableRate(subscriptionDiscountRate);
  const subscriptionKeys: readonly string[] = ['ai', 'streaming', 'music'];

  return DESIGN_CATEGORIES.map(category => ({
    key: category.key,
    label: category.label,
    rate: subscriptionKeys.includes(category.key) ? flat : fallback[category.key],
  }));
};

/** "a", "a and b", "a, b and c". */
const joinLabels = (labels: string[]): string =>
  labels.length > 1
    ? `${labels.slice(0, -1).join(', ')} and ${labels[labels.length - 1]}`
    : (labels[0] ?? '');

/** Cheapest tier first, which is the order an "unlocks at" answer wants. */
const TIER_LADDER: readonly RewardsTier[] = [
  RewardsTier.CORE,
  RewardsTier.PRIME,
  RewardsTier.ULTRA,
];

/**
 * The cheapest tier that earns anything on `key`, or undefined when none does.
 *
 * The tier comparison page labels a locked category with the tier that would
 * unlock it, and that answer is config: Airlines reads "Ultra" because Prime's
 * rate on it is an explicit 0 today, not because Airlines is inherently an
 * Ultra perk. Pricing Prime onto Airlines in the admin portal has to move the
 * label with it.
 *
 * Takes each tier's reported rates structurally rather than `TierBenefits`, so
 * this stays a function of the numbers and the page keeps the API shape.
 */
export const unlockTierForCategory = (
  key: string,
  byTier: { tier: RewardsTier; subscriptionCategoryRates?: SubscriptionCategoryRate[] }[],
): RewardsTier | undefined =>
  TIER_LADDER.find(tier =>
    byTier
      .find(entry => entry.tier === tier)
      ?.subscriptionCategoryRates?.some(rate => rate.key === key && usableRate(rate.rate) > 0),
  );

/**
 * Everything a category surface paints, for one tier.
 *
 * `categories` is the whole truth and comes from the API: its list, its labels
 * and its rates. Read it rather than iterating a local table — that is what
 * lets a category added, renamed or paused in the admin portal reach the app
 * without a release.
 *
 * `subscriptionDiscountRate` is still accepted for backends that predate
 * `subscriptionCategoryRates`; when both are present the per-category list
 * wins, because one flat rate cannot describe a tier that pays differently per
 * category.
 */
export const categoryCashbackPresentation = (
  tier: RewardsTier,
  subscriptionDiscountRate: number,
  categoryRates?: SubscriptionCategoryRate[],
) => {
  const categories = resolveCategories(tier, categoryRates, subscriptionDiscountRate);
  const unlocked = categories.filter(category => category.rate > 0);
  const best = unlocked.length ? Math.max(...unlocked.map(category => category.rate)) : 0;
  // Core sees 0 on everything, so it advertises the whole offer rather than an
  // empty sentence; every other tier names only what it actually earns on.
  const named = tier === RewardsTier.CORE ? categories : unlocked;

  return {
    categories,
    /** What `tier` earns on one category, in percentage points. 0 when absent or locked. */
    rateFor: (key: string): number => categories.find(category => category.key === key)?.rate ?? 0,
    // Core unlocks nothing, so it advertises the ceiling an upgrade reaches
    // rather than its own 0.
    headlineRate: tier === RewardsTier.CORE ? CORE_HEADLINE_RATE : best,
    // Built from the live labels rather than a fixed phrase: the old copy named
    // "subscriptions, rides and flights", which silently became a lie the first
    // time someone paused one or added a sixth category.
    subtitle: named.length
      ? tier === RewardsTier.CORE
        ? `on ${joinLabels(named.map(category => category.label))} with Prime or Ultra`
        : `on ${joinLabels(named.map(category => category.label))}`
      : 'on eligible card spend',
    actionLabel:
      tier === RewardsTier.CORE
        ? 'Upgrade to Prime'
        : tier === RewardsTier.PRIME
          ? 'Upgrade to Ultra'
          : 'Got it',
    upgradeTier: tier === RewardsTier.CORE ? RewardsTier.PRIME : RewardsTier.ULTRA,
  };
};
