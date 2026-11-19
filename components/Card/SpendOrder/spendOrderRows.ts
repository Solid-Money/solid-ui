import { REORDER_DIVIDER } from '@/components/Card/OrderList/reorder';
import {
  type SpendAssetKey,
  spendAssetKeyOf,
  type SpendOrderPreference,
} from '@/lib/utils/spendOrder';

import type {
  SpendableAssetIcon,
  SpendableAssetRow,
} from '@/components/Card/NewCardDetails/SpendMode/useSpendableAssetRows';
import type { CardSpendableAsset } from '@/constants/cardSpendableAssets';

/** One asset on the Spend order screen: every holding of it, on Fuse and Base together. */
export interface SpendOrderRow {
  key: SpendAssetKey;
  icon: SpendableAssetIcon;
  /** "USDC", "USD Yield", "Bitcoin". */
  name: string;
  /** "Earning until it’s needed", "First for euro shops"; replaced on an excluded row. */
  subtitle?: string;
  /** "$100.00", or "€74.20" for a euro asset. */
  value: string;
  /** "18.47 soUSD", "≈ $86.50". */
  detail?: string;
}

/** The row an asset gets when the Safe holds none of it: its name and a zero. */
const EMPTY_ROW: Record<SpendAssetKey, Omit<SpendOrderRow, 'key' | 'value'> & { euro?: boolean }> =
  {
    USDC: { icon: 'usdc', name: 'USDC' },
    USDT: { icon: 'usdt', name: 'USDT' },
    USD_YIELD: { icon: 'sousd', name: 'USD Yield' },
    EURC: { icon: 'eurc', name: 'EURC', euro: true },
    EUR_YIELD: { icon: 'soeur', name: 'EUR Yield', euro: true },
    BTC: { icon: 'cbbtc', name: 'Bitcoin' },
    BTC_YIELD: { icon: 'sobtc', name: 'BTC Yield' },
    WBTC: { icon: 'wbtc', name: 'Wrapped Bitcoin' },
    ETH: { icon: 'weth', name: 'Ethereum' },
    ETH_YIELD: { icon: 'soeth', name: 'ETH Yield' },
    SOL: { icon: 'sol', name: 'Solana' },
    AAVE: { icon: 'aave', name: 'Aave' },
    ZEC: { icon: 'zec', name: 'Zcash' },
  };

/** Figma 30971:15192: what each asset is for, under its name. */
const SUBTITLE: Partial<Record<SpendAssetKey, string>> = {
  USD_YIELD: 'Earning until it’s needed',
  EUR_YIELD: 'Earning until it’s needed',
  ETH_YIELD: 'Earning until it’s needed',
  BTC_YIELD: 'Earning until it’s needed',
  EURC: 'First for euro shops',
  BTC: 'Sold at market price',
  WBTC: 'Sold at market price',
  ETH: 'Sold at market price',
  SOL: 'Sold at market price',
  AAVE: 'Sold at market price',
  ZEC: 'Sold at market price',
};

const money = (amount: number, currency: 'USD' | 'EUR'): string =>
  amount.toLocaleString('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

/**
 * One row per asset the card can spend, held or not, keyed by spend-order key.
 *
 * soUSD on Fuse and on Base are one row: the order ranks the asset, and the backend picks the
 * network. Two holdings of one asset are added up — a single holding keeps the panel's own value
 * and detail, so the figures match the Cash sheet's.
 */
export const buildSpendOrderRows = (
  assets: readonly CardSpendableAsset[],
  held: readonly SpendableAssetRow[],
): Map<SpendAssetKey, SpendOrderRow> => {
  const rows = new Map<SpendAssetKey, SpendOrderRow>();

  for (const asset of assets) {
    const key = spendAssetKeyOf(asset.symbol);
    if (!key || rows.has(key)) continue;

    const holdings = held.filter(row => row.spendKey === key);
    const empty = EMPTY_ROW[key];
    const base = { key, icon: empty.icon, name: empty.name, subtitle: SUBTITLE[key] };

    if (holdings.length === 0) {
      rows.set(key, { ...base, value: money(0, empty.euro ? 'EUR' : 'USD') });
    } else if (holdings.length === 1) {
      rows.set(key, { ...base, value: holdings[0].value, detail: holdings[0].detail });
    } else {
      // Only the shares and the stables are held twice (Fuse and Base), and those read in dollars.
      const usd = holdings.reduce((sum, row) => sum + row.usd, 0);
      const amount = holdings.reduce((sum, row) => sum + row.amount, 0);
      const ticker = holdings[0].name;
      rows.set(key, {
        ...base,
        value: money(usd, 'USD'),
        detail: holdings[0].detail ? `${amount.toFixed(2)} ${ticker}` : undefined,
      });
    }
  }

  return rows;
};

/** The divider between what the card spends and what it won't use. */
export const DIVIDER = REORDER_DIVIDER;

/** The visible list: the spent assets in order, the divider, then the excluded ones. */
export const toSlots = (
  preference: SpendOrderPreference,
  visible: ReadonlySet<SpendAssetKey>,
): string[] => {
  const shown = preference.order.filter(key => visible.has(key));
  return [
    ...shown.filter(key => !preference.excluded.includes(key)),
    DIVIDER,
    ...shown.filter(key => preference.excluded.includes(key)),
  ];
};

/**
 * The preference after the visible list was rearranged into `slots`.
 *
 * Assets the screen does not show — ones this card cannot spend yet — keep their place in the order
 * and their exclusion, so turning Base on later finds them where they were.
 */
export const fromSlots = (
  slots: readonly string[],
  preference: SpendOrderPreference,
  visible: ReadonlySet<SpendAssetKey>,
): SpendOrderPreference => {
  const divider = slots.indexOf(DIVIDER);
  const spent = slots.slice(0, divider) as SpendAssetKey[];
  const excluded = slots.slice(divider + 1) as SpendAssetKey[];
  const rearranged = [...spent, ...excluded];

  let next = 0;
  return {
    order: preference.order.map(key => (visible.has(key) ? rearranged[next++] : key)),
    excluded: [...preference.excluded.filter(key => !visible.has(key)), ...excluded],
  };
};

/**
 * Whether the visible list leaves the card nothing to spend: every listed asset is below the
 * divider. Save stays off then — the backend refuses an order that excludes everything.
 */
export const spendsNothing = (slots: readonly string[]): boolean =>
  slots.indexOf(DIVIDER) === 0 && slots.length > 1;
