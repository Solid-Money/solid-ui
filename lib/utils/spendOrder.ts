/**
 * The order a Wirex card spends the cardholder's balances in, and the ones it never touches.
 *
 * Keyed by asset, not by contract: soUSD on Fuse and soUSD on Base are one `USD_YIELD` entry,
 * because the cardholder ranks what they hold, not where it sits. The backend resolves each key to
 * a contract on whichever network pays the purchase, so this list says nothing about networks.
 */
export type SpendAssetKey =
  | 'USDC'
  | 'USDT'
  | 'USD_YIELD'
  | 'EURC'
  | 'EUR_YIELD'
  | 'BTC'
  | 'BTC_YIELD'
  | 'WBTC'
  | 'ETH'
  | 'ETH_YIELD'
  | 'SOL'
  | 'AAVE'
  | 'ZEC';

/**
 * Today's order, and what a cardholder who never opens the Spend order screen keeps: stables,
 * then the yield shares, then crypto. Also what an older backend that sends no order reads as.
 */
export const DEFAULT_SPEND_ORDER: readonly SpendAssetKey[] = [
  'USDC',
  'USDT',
  'USD_YIELD',
  'EURC',
  'EUR_YIELD',
  'BTC',
  'BTC_YIELD',
  'WBTC',
  'ETH',
  'ETH_YIELD',
  'SOL',
  'AAVE',
  'ZEC',
];

const KEY_BY_SYMBOL: Readonly<Record<string, SpendAssetKey>> = {
  USDC: 'USDC',
  USDT: 'USDT',
  soUSD: 'USD_YIELD',
  EURC: 'EURC',
  soEUR: 'EUR_YIELD',
  cbBTC: 'BTC',
  // Base soBTC and Base WBTC (BitGo's LayerZero OFT): each its own row, never folded into cbBTC.
  soBTC: 'BTC_YIELD',
  WBTC: 'WBTC',
  WETH: 'ETH',
  soETH: 'ETH_YIELD',
  SOL: 'SOL',
  AAVE: 'AAVE',
  cbZEC: 'ZEC',
};

/** The spend-order key for a wallet ticker ("soUSD" → `USD_YIELD`), or undefined for any other. */
export const spendAssetKeyOf = (symbol: string | undefined): SpendAssetKey | undefined =>
  symbol ? KEY_BY_SYMBOL[symbol] : undefined;

const isSpendAssetKey = (value: string): value is SpendAssetKey =>
  (DEFAULT_SPEND_ORDER as readonly string[]).includes(value);

/** A cardholder's preference: every key once, ranked, and the ones the card must not use. */
export interface SpendOrderPreference {
  order: SpendAssetKey[];
  excluded: SpendAssetKey[];
}

export const DEFAULT_SPEND_ORDER_PREFERENCE: SpendOrderPreference = {
  order: [...DEFAULT_SPEND_ORDER],
  excluded: [],
};

/**
 * Every key once, in the given order, with any key it leaves out at its default position.
 *
 * The backend sends the full list today; this keeps the app right against one that sends a partial
 * list, or a key this build does not know (dropped rather than guessed at).
 */
export const normalizeSpendOrder = (
  order: readonly string[] | undefined,
  excluded: readonly string[] | undefined,
): SpendOrderPreference => {
  const ranked = [...new Set((order ?? []).filter(isSpendAssetKey))];
  for (const [index, key] of DEFAULT_SPEND_ORDER.entries()) {
    if (ranked.includes(key)) continue;
    // In front of the first ranked key that comes after it by default, so a key a newer build
    // added lands where it would have in today's order rather than at the bottom.
    const after = DEFAULT_SPEND_ORDER.slice(index + 1).find(next => ranked.includes(next));
    const at = after ? ranked.indexOf(after) : ranked.length;
    ranked.splice(at, 0, key);
  }

  return {
    order: ranked,
    excluded: [...new Set((excluded ?? []).filter(isSpendAssetKey))],
  };
};

/**
 * The preference a `GET /wirex/spend-order` answer stands for. Each field is read on its own: an
 * answer with exclusions and no order keeps its exclusions over the default order, and no answer
 * at all is the default order with nothing excluded.
 */
export const spendOrderPreferenceOf = (
  data: { spendOrder?: readonly string[]; spendExcluded?: readonly string[] } | undefined,
): SpendOrderPreference => normalizeSpendOrder(data?.spendOrder, data?.spendExcluded);

/** Whether two preferences would spend the same way. */
export const sameSpendOrder = (a: SpendOrderPreference, b: SpendOrderPreference): boolean =>
  a.order.length === b.order.length &&
  a.order.every((key, index) => key === b.order[index]) &&
  a.excluded.length === b.excluded.length &&
  a.excluded.every(key => b.excluded.includes(key));

/** Where a key sits in the order, for sorting; a key the order does not name sorts last. */
export const spendRank = (
  order: readonly SpendAssetKey[],
  key: SpendAssetKey | undefined,
): number => {
  const rank = key ? order.indexOf(key) : -1;
  return rank === -1 ? order.length : rank;
};
