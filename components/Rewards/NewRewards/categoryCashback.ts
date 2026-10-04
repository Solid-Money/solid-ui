import { RewardsTier, type SubscriptionCategoryRate } from '@/lib/types';

export const CATEGORY_CASHBACK_TABS = [
  { key: 'ai', label: 'AI' },
  { key: 'streaming', label: 'Streaming' },
  { key: 'music', label: 'Music' },
  { key: 'rides', label: 'Rides' },
  { key: 'airlines', label: 'Airlines' },
] as const;

export type CashbackCategoryKey = (typeof CATEGORY_CASHBACK_TABS)[number]['key'];

const CATEGORY_KEYS = CATEGORY_CASHBACK_TABS.map(tab => tab.key) as readonly CashbackCategoryKey[];

const isCategoryKey = (key: string): key is CashbackCategoryKey =>
  (CATEGORY_KEYS as readonly string[]).includes(key);

/**
 * Rates the backend used to have no way of expressing.
 *
 * Rates are per category — Prime earns 10% on AI but 8% on Rides — and until
 * `subscriptionCategoryRates` shipped, the payload carried one flat
 * `subscriptionDiscountRate` for the whole tier. These are the v4 Figma values
 * and are only reached on a backend that does not send the per-category rates
 * yet; once it does, every rate on this sheet comes from the API.
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

/**
 * The categories to actually show, in the sheet's own tab order.
 *
 * Once the API sends per-category rates, the list it sends is the list that is
 * on offer: an admin who switches a category off in the portal drops it from
 * the payload, and it must disappear from the sheet rather than reappear at
 * its design rate. That is why a paused category is omitted rather than sent
 * at 0 — a 0 is the locked state an upgrade unlocks, and the sheet still
 * paints it.
 *
 * Without the payload (an older backend) every tab is shown, which is what the
 * sheet did before any of this existed.
 */
const resolveVisibleCategories = (
  categoryRates: SubscriptionCategoryRate[] | undefined,
): CashbackCategoryKey[] => {
  if (!categoryRates?.length) return [...CATEGORY_KEYS];

  const sent = new Set(
    categoryRates.filter(entry => entry && isCategoryKey(entry.key)).map(entry => entry.key),
  );

  return CATEGORY_KEYS.filter(key => sent.has(key));
};

/** Mid-sentence name for each group of categories the subtitle names. */
const SUBSCRIPTION_KEYS: readonly CashbackCategoryKey[] = ['ai', 'streaming', 'music'];

/**
 * "on subscriptions, rides and flights" — built from what is actually on the
 * sheet, so pausing Rides does not leave the headline promising them.
 *
 * Airlines is named only when the tier earns on it (Prime's 0 is the locked
 * Ultra-only state), except on Core, which advertises the whole offer because
 * every rate it sees is 0.
 */
const resolveSubtitleGroups = (
  tier: RewardsTier,
  visible: CashbackCategoryKey[],
  rates: Record<CashbackCategoryKey, number>,
): string[] => {
  const shows = (key: CashbackCategoryKey) =>
    visible.includes(key) && (tier === RewardsTier.CORE || rates[key] > 0);

  return [
    SUBSCRIPTION_KEYS.some(key => visible.includes(key)) ? 'subscriptions' : undefined,
    visible.includes('rides') ? 'rides' : undefined,
    shows('airlines') ? 'flights' : undefined,
  ].filter((group): group is string => !!group);
};

/** "a", "a and b", "a, b and c". */
const joinGroups = (groups: string[]): string =>
  groups.length > 1
    ? `${groups.slice(0, -1).join(', ')} and ${groups[groups.length - 1]}`
    : groups[0];

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
  key: CashbackCategoryKey,
  byTier: { tier: RewardsTier; subscriptionCategoryRates?: SubscriptionCategoryRate[] }[],
): RewardsTier | undefined =>
  TIER_LADDER.find(tier =>
    byTier
      .find(entry => entry.tier === tier)
      ?.subscriptionCategoryRates?.some(rate => rate.key === key && usableRate(rate.rate) > 0),
  );

/**
 * Rates for the sheet, preferring what the API reports for the current tier.
 *
 * Only the categories this app has artwork and copy for are kept — a category
 * added in the admin portal (or one it does not ship, like Gaming) appears in
 * the payload but has no tab here, and rendering it would reach into
 * `CATEGORY_CASHBACK_BRANDS` for a key that does not exist. A known category
 * the API omits keeps its design rate here rather than reading as locked;
 * whether it is shown at all is `resolveVisibleCategories`' decision, not this
 * one's.
 */
const resolveRates = (
  tier: RewardsTier,
  categoryRates: SubscriptionCategoryRate[] | undefined,
  subscriptionDiscountRate: number,
): Record<CashbackCategoryKey, number> => {
  const fallback = FALLBACK_RATES[tier] ?? FALLBACK_RATES[RewardsTier.CORE];

  if (categoryRates?.length) {
    const rates = { ...fallback };

    for (const entry of categoryRates) {
      if (entry && isCategoryKey(entry.key)) {
        // An explicit 0 means locked for this tier, so it is kept as sent.
        rates[entry.key] = usableRate(entry.rate);
      }
    }

    return rates;
  }

  // Older backend: one flat rate covers the subscription categories, and Rides
  // and Airlines fall back to the design values for the tier.
  const flat = usableRate(subscriptionDiscountRate);

  return {
    ...fallback,
    ai: flat,
    streaming: flat,
    music: flat,
  };
};

/**
 * Everything the category sheet paints, for one tier.
 *
 * `subscriptionDiscountRate` is still accepted for backends that predate
 * `categoryRates`; when both are present the per-category rates win, because
 * the flat rate cannot describe a tier that pays differently per category.
 *
 * `categories` is what to render. Read it rather than iterating every tab:
 * `rates` keeps a figure for each known key so the fallback stays simple, but
 * a category the backend has switched off is not in `categories` and must not
 * be painted.
 */
export const categoryCashbackPresentation = (
  tier: RewardsTier,
  subscriptionDiscountRate: number,
  categoryRates?: SubscriptionCategoryRate[],
) => {
  const rates = resolveRates(tier, categoryRates, subscriptionDiscountRate);
  const categories = resolveVisibleCategories(categoryRates);
  const unlocked = categories.filter(key => rates[key] > 0);
  const best = unlocked.length ? Math.max(...unlocked.map(key => rates[key])) : 0;
  const groups = resolveSubtitleGroups(tier, categories, rates);

  return {
    rates,
    /**
     * The categories to render, in tab order — everything the backend still
     * has switched on. Empty when every one of them is paused, which the sheet
     * reads as "nothing to show".
     */
    categories,
    // Core unlocks nothing, so it advertises the ceiling an upgrade reaches
    // rather than its own 0.
    headlineRate: tier === RewardsTier.CORE ? CORE_HEADLINE_RATE : best,
    subtitle: groups.length
      ? tier === RewardsTier.CORE
        ? `on ${joinGroups(groups)} with Prime or Ultra`
        : `on ${joinGroups(groups)}`
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
