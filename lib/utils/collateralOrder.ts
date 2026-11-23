import { base } from 'viem/chains';

import type { SpendAssetKey } from '@/lib/utils/spendOrder';

/**
 * The order a Wirex card locks collateral in when it borrows (Credit mode).
 *
 * A separate list from the spend order, and reorder only: every collateral the card can lock stays
 * in it, and the order only decides which one is locked first. Keyed by asset like the spend order
 * (a subset of its keys), so soUSD on Fuse and soUSD on Base are one `USD_YIELD` entry.
 *
 * It governs new locks only — the shortfall after what is already escrowed — and the shop's own
 * yield share still comes first: EUR Yield at a euro shop, USD Yield at a dollar shop.
 *
 * USDC, USDT and EURC are collateral on Base only (Fuse locks soUSD alone), at soUSD's and soEUR's
 * tier: LTV 90%, threshold 95%.
 */
export type CollateralAssetKey = Extract<
  SpendAssetKey,
  | 'USD_YIELD'
  | 'EUR_YIELD'
  | 'USDC'
  | 'USDT'
  | 'EURC'
  | 'BTC'
  | 'BTC_YIELD'
  | 'WBTC'
  | 'ETH'
  | 'ETH_YIELD'
  | 'SOL'
  | 'AAVE'
  | 'ZEC'
>;

/**
 * The configured Base lock order (`CASH_BASE_CREDIT_COLLATERAL_PRIORITY`), and what a cardholder
 * who never opens the Collateral order screen keeps. Fuse locks soUSD only.
 */
export const DEFAULT_COLLATERAL_ORDER: readonly CollateralAssetKey[] = [
  'USD_YIELD',
  'EUR_YIELD',
  'USDC',
  'USDT',
  'EURC',
  'BTC',
  'BTC_YIELD',
  'WBTC',
  'ETH',
  'ETH_YIELD',
  'SOL',
  'AAVE',
  'ZEC',
];

const KEY_BY_SYMBOL: Readonly<Record<string, CollateralAssetKey>> = {
  soUSD: 'USD_YIELD',
  soEUR: 'EUR_YIELD',
  // Base's native USDC. Fuse's bridged USDC is "USDC.e", which is not collateral and maps to none.
  USDC: 'USDC',
  USDT: 'USDT',
  EURC: 'EURC',
  cbBTC: 'BTC',
  soBTC: 'BTC_YIELD',
  WBTC: 'WBTC',
  WETH: 'ETH',
  soETH: 'ETH_YIELD',
  SOL: 'SOL',
  AAVE: 'AAVE',
  cbZEC: 'ZEC',
};

/**
 * The stables, which only the Base instance takes as collateral. Fuse's USDT shares the ticker, so
 * a token on any other chain never maps to these.
 */
const BASE_ONLY_KEYS: ReadonlySet<CollateralAssetKey> = new Set(['USDC', 'USDT', 'EURC']);

/**
 * The collateral key for a token's symbol ("cbBTC" → `BTC`), or undefined for any other. With a
 * chain, the stables map on Base only: Fuse USDC.e and USDT are spendable there, never collateral.
 */
export const collateralAssetKeyOf = (
  symbol: string | undefined,
  chainId?: number,
): CollateralAssetKey | undefined => {
  const key = symbol ? KEY_BY_SYMBOL[symbol] : undefined;
  if (key && chainId !== undefined && chainId !== base.id && BASE_ONLY_KEYS.has(key)) {
    return undefined;
  }
  return key;
};

export const isCollateralAssetKey = (value: string): value is CollateralAssetKey =>
  (DEFAULT_COLLATERAL_ORDER as readonly string[]).includes(value);

/**
 * Every collateral key once, in the given order, with any key it leaves out at its default
 * position. The backend sends the full list; this keeps the app right against a partial one, and
 * drops a key this build does not know rather than guessing where it goes.
 *
 * With `known` (the backend's own `defaultCollateralOrder`), only keys the backend also names are
 * kept or added. The order is sent back on Save and in the preview, and a backend older than a key
 * rejects the whole list with a 400: the stables reached this build before the backend that
 * accepts them.
 */
export const normalizeCollateralOrder = (
  order: readonly string[] | undefined,
  known?: readonly string[],
): CollateralAssetKey[] => {
  const defaults = known
    ? DEFAULT_COLLATERAL_ORDER.filter(key => known.includes(key))
    : DEFAULT_COLLATERAL_ORDER;
  const ranked = [
    ...new Set((order ?? []).filter(isCollateralAssetKey).filter(key => defaults.includes(key))),
  ];
  for (const [index, key] of defaults.entries()) {
    if (ranked.includes(key)) continue;
    // In front of the first ranked key that follows it by default, so a key a newer build added
    // lands where today's order would put it rather than at the bottom.
    const after = defaults.slice(index + 1).find(next => ranked.includes(next));
    ranked.splice(after ? ranked.indexOf(after) : ranked.length, 0, key);
  }
  return ranked;
};

/** Whether two orders lock the same way. */
export const sameCollateralOrder = (
  a: readonly CollateralAssetKey[],
  b: readonly CollateralAssetKey[],
): boolean => a.length === b.length && a.every((key, index) => key === b[index]);

/** Where a key sits in the order, for sorting; a key the order does not name sorts last. */
export const collateralRank = (
  order: readonly CollateralAssetKey[],
  key: CollateralAssetKey | undefined,
): number => {
  const rank = key ? order.indexOf(key) : -1;
  return rank === -1 ? order.length : rank;
};

/**
 * `items` sorted by their key's place in `order`, keeping their own order between items of one
 * key (soUSD on Fuse before soUSD on Base) and putting an item with no key last.
 */
export const sortByCollateralOrder = <T>(
  items: readonly T[],
  keyOf: (item: T) => CollateralAssetKey | undefined,
  order: readonly CollateralAssetKey[],
): T[] =>
  items
    .map((item, index) => ({ item, index, rank: collateralRank(order, keyOf(item)) }))
    .sort((a, b) => a.rank - b.rank || a.index - b.index)
    .map(entry => entry.item);

/** The keys of `order` the screen lists, in order. */
export const visibleCollateralOrder = (
  order: readonly CollateralAssetKey[],
  visible: ReadonlySet<CollateralAssetKey>,
): CollateralAssetKey[] => order.filter(key => visible.has(key));

/**
 * The full order after the listed keys were rearranged into `next`. Keys the screen does not
 * list — collateral this card cannot lock yet — keep their place, so enabling Base later finds
 * them where they were.
 */
export const withVisibleCollateralOrder = (
  next: readonly string[],
  order: readonly CollateralAssetKey[],
  visible: ReadonlySet<CollateralAssetKey>,
): CollateralAssetKey[] => {
  const rearranged = next.filter(
    (key): key is CollateralAssetKey => isCollateralAssetKey(key) && visible.has(key),
  );
  // Not a permutation of what is listed (rows landed mid-drag): keep the order as it was.
  if (rearranged.length !== order.filter(key => visible.has(key)).length) return [...order];
  let at = 0;
  return order.map(key => (visible.has(key) ? rearranged[at++] : key));
};
