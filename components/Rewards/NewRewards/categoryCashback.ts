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
 * Rates for the sheet, preferring what the API reports for the current tier.
 *
 * Only the categories this app has artwork and copy for are kept — a category
 * added in the admin portal (or one it does not ship, like Gaming) appears in
 * the payload but has no tab here, and rendering it would reach into
 * `CATEGORY_CASHBACK_BRANDS` for a key that does not exist. A known category
 * the API omits keeps its design rate rather than silently reading as locked.
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
 */
export const categoryCashbackPresentation = (
  tier: RewardsTier,
  subscriptionDiscountRate: number,
  categoryRates?: SubscriptionCategoryRate[],
) => {
  const rates = resolveRates(tier, categoryRates, subscriptionDiscountRate);
  const unlocked = CATEGORY_KEYS.filter(key => rates[key] > 0);
  const best = unlocked.length ? Math.max(...unlocked.map(key => rates[key])) : 0;

  return {
    rates,
    // Core unlocks nothing, so it advertises the ceiling an upgrade reaches
    // rather than its own 0.
    headlineRate: tier === RewardsTier.CORE ? CORE_HEADLINE_RATE : best,
    subtitle:
      tier === RewardsTier.CORE
        ? 'on subscriptions, rides and flights with Prime or Ultra'
        : rates.airlines > 0
          ? 'on subscriptions, rides and flights'
          : 'on subscriptions and rides',
    actionLabel:
      tier === RewardsTier.CORE
        ? 'Upgrade to Prime'
        : tier === RewardsTier.PRIME
          ? 'Upgrade to Ultra'
          : 'Got it',
    upgradeTier: tier === RewardsTier.CORE ? RewardsTier.PRIME : RewardsTier.ULTRA,
  };
};
