import { fuse } from 'viem/chains';

import { fallbackTierFees, formatFeeValue } from '@/components/Rewards/NewRewards/tierFees';
import {
  isSwapPairOpen,
  SWAP_CHAIN_IDS,
  SWAP_LIST,
  SwapAssetCategory,
  swapAssetKey,
  swapListing,
} from '@/constants/swapChains';
import { RewardsTier } from '@/lib/types';
import { SwapAsset, SwapAssetWithBalance } from '@/lib/types/lifi-swap';

/**
 * The swap pickers list assets, not contracts: USDC is one row however many
 * networks it is held on, and soUSD is "USD Yield". The network is picked for
 * the user (the one holding most on "You pay", the quickest to arrive on "You
 * get") and named only where it matters. What's offered is `SWAP_LIST`.
 */

export type { SwapAssetCategory };

/** Share tokens, by the product they are, for coins off the swap list. */
const YIELD_PRODUCTS: Record<string, string> = {
  soUSD: 'USD Yield',
  soUSDC: 'USD Yield',
  soETH: 'ETH Yield',
  soFUSE: 'FUSE Yield',
  soEURC: 'EUR Yield',
};

/** Bridged and re-issued versions that are the same money to the user. */
const SAME_ASSET: Record<string, string> = {
  USDCe: 'USDC',
  'USDC.e': 'USDC',
  USDbC: 'USDC',
  USDT0: 'USDT',
  'USD₮0': 'USDT',
  'USDT.e': 'USDT',
};

const STABLECOINS = new Set([
  'USDC',
  'USDT',
  'DAI',
  'USDS',
  'PYUSD',
  'FDUSD',
  'USDe',
  'EURC',
  'EURe',
  'EURS',
  'EURA',
]);

const DESCRIPTIONS: Record<string, string> = {
  USDC: 'Dollar coin',
  USDT: 'Dollar coin',
  EURC: 'Euro coin',
  FUSE: 'Fuse token',
  WFUSE: 'Wrapped FUSE',
  ETH: 'Ether',
  WETH: 'Wrapped Ether',
  cbBTC: 'Bitcoin, by Coinbase',
  WBTC: 'Wrapped Bitcoin',
  AAVE: 'Aave',
  ENA: 'Ethena',
  SOL: 'Solana',
  UNI: 'Uniswap',
};

/** The line under a coin's name when nothing more pressing is said there. */
const describe = (identity: SwapAssetIdentity, asset: SwapAsset) =>
  identity.isYield
    ? `Earn on ${identity.name.replace(' Yield', '')}`
    : (DESCRIPTIONS[identity.name] ?? asset.name);

/** Where each row sits within its section: the swap list's order. */
const LIST_ORDER = new Map<string, number>();
SWAP_LIST.forEach((listing, index) => {
  if (!LIST_ORDER.has(listing.name)) LIST_ORDER.set(listing.name, index);
});

export interface SwapAssetIdentity {
  /** One row per key. */
  key: string;
  /** "USD Yield", "USDC", "ETH". */
  name: string;
  category: SwapAssetCategory;
  isYield: boolean;
}

type NamedAsset = { symbol: string; chainId?: number; address?: string };

/** A coin's row: the swap list's entry when it's on it, its symbol when not. */
export function assetIdentity(asset: NamedAsset): SwapAssetIdentity {
  const listing =
    asset.chainId !== undefined && asset.address
      ? swapListing({ chainId: asset.chainId, address: asset.address })
      : undefined;
  if (listing) {
    return {
      key: listing.name,
      name: listing.name,
      category: listing.category,
      isYield: listing.category === 'earn',
    };
  }
  const product = YIELD_PRODUCTS[asset.symbol];
  if (product) return { key: product, name: product, category: 'earn', isYield: true };
  const name = SAME_ASSET[asset.symbol] ?? asset.symbol;
  const category: SwapAssetCategory = STABLECOINS.has(name) ? 'stablecoins' : 'crypto';
  return { key: name, name, category, isYield: false };
}

/** "USD Yield", "USDC": how the screens name an asset, never its share token. */
export const assetDisplayName = (asset: NamedAsset) => assetIdentity(asset).name;

export interface SwapAssetRow {
  key: string;
  name: string;
  subtitle: string;
  category: SwapAssetCategory;
  /** What a tap selects. */
  asset: SwapAssetWithBalance;
  /** Every network it's on, the selected one first. */
  members: SwapAssetWithBalance[];
  balance: number;
  balanceUsd: number;
}

export interface SwapAssetSection {
  key: string;
  title: string;
  rows: SwapAssetRow[];
}

type ChainName = (chainId: number) => string;

const byValue = (a: SwapAssetWithBalance, b: SwapAssetWithBalance) =>
  b.balanceUsd - a.balanceUsd || b.balance - a.balance;

const matches = (row: Pick<SwapAssetRow, 'name' | 'members'>, query: string) => {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return (
    row.name.toLowerCase().includes(q) ||
    row.members.some(
      member => member.symbol.toLowerCase().includes(q) || member.name.toLowerCase().includes(q),
    )
  );
};

const groupBy = (assets: SwapAssetWithBalance[]) => {
  const groups = new Map<string, SwapAssetWithBalance[]>();
  for (const asset of assets) {
    const { key } = assetIdentity(asset);
    groups.set(key, [...(groups.get(key) ?? []), asset]);
  }
  return groups;
};

const section = (key: string, title: string, rows: SwapAssetRow[]): SwapAssetSection[] =>
  rows.length ? [{ key, title, rows }] : [];

/** Stablecoins, Earn, Crypto: the design's order, on both pickers. */
const bySection = (rows: SwapAssetRow[]): SwapAssetSection[] => {
  const inCategory = (category: SwapAssetCategory) => rows.filter(row => row.category === category);
  return [
    ...section('stablecoins', 'Stablecoins', inCategory('stablecoins')),
    ...section('earn', 'Earn', inCategory('earn')),
    ...section('crypto', 'Crypto', inCategory('crypto')),
  ];
};

/** A row's place within its section: the swap list's order. */
const listOrder = (row: SwapAssetRow) => LIST_ORDER.get(row.name) ?? SWAP_LIST.length;

const byValueThenList = (a: SwapAssetRow, b: SwapAssetRow) =>
  b.balanceUsd - a.balanceUsd || listOrder(a) - listOrder(b);

/** On the swap list, and in this environment's catalogue so the backend quotes it. */
const onList = (asset: SwapAssetWithBalance) => asset.swappable && !!swapListing(asset);

/**
 * "You pay": only what can be swapped, which is what the user holds of the
 * swap list, one row per asset, every network holding it among its `members`,
 * the most valuable first. Holdings off the list (another network's coin, an
 * Earn share withdrawn in Earn, an old bridged USDC) and coins not held aren't
 * shown.
 */
export function payAssetSections(
  assets: SwapAssetWithBalance[],
  { query = '', chainName }: { query?: string; chainName: ChainName },
): SwapAssetSection[] {
  const held = assets.filter(asset => asset.balance > 0 && onList(asset));
  const rows: SwapAssetRow[] = [];

  for (const members of groupBy(held).values()) {
    const sorted = [...members].sort(byValue);
    const [asset] = sorted;
    const identity = assetIdentity(asset);
    const subtitle =
      sorted.length > 1
        ? `On ${sorted.length} networks`
        : asset.chainId !== fuse.id
          ? `On ${chainName(asset.chainId)}`
          : describe(identity, asset);
    rows.push({
      key: identity.key,
      name: identity.name,
      subtitle,
      category: identity.category,
      asset,
      members: sorted,
      balance: sorted.reduce((sum, member) => sum + member.balance, 0),
      balanceUsd: sorted.reduce((sum, member) => sum + member.balanceUsd, 0),
    });
  }

  return bySection(rows.filter(row => matches(row, query)).sort(byValueThenList));
}

/**
 * "You get": only what the "You pay" asset can become, one row per asset, in
 * the swap list's order, arriving on the network quickest to reach: the same
 * one when it's there, then in `SWAP_CHAIN_IDS` order, every reachable network
 * among its `members`. Only pairs `isSwapPairOpen` allows are offered.
 *
 * `reachable` is the backend's answer for the "You pay" token, as
 * `chainId:address` keys. Null while it loads or when it couldn't be read: the
 * pairs `isSwapPairOpen` allows are offered and the quote has the last word.
 * It speaks for every pair except Fuse to Fuse (Algebra reaches every Fuse
 * coin) and into Fuse from another network (LI.FI's route map doesn't list
 * Stargate with the paymaster paying its fee).
 */
export function getAssetSections(
  assets: SwapAssetWithBalance[],
  {
    from,
    reachable,
    query = '',
    chainName,
  }: {
    from: SwapAsset | undefined;
    reachable: ReadonlySet<string> | null;
    query?: string;
    chainName: ChainName;
  },
): SwapAssetSection[] {
  const fromKey = from ? swapAssetKey(from) : undefined;
  const isFrom = (asset: SwapAsset) => swapAssetKey(asset) === fromKey;
  const canBecome = (asset: SwapAssetWithBalance) => {
    if (!onList(asset) || isFrom(asset)) return false;
    if (!from) return true;
    if (!isSwapPairOpen(from.chainId, asset.chainId)) return false;
    // Arriving on Fuse: Algebra from a Fuse coin, and from another network
    // Stargate with the paymaster paying its fee, which LI.FI's route map
    // doesn't list. The quote has the last word on those.
    if (asset.chainId === fuse.id) return true;
    // Leaving Fuse, the backend lists only the coins a sponsored swap delivers.
    return !reachable || reachable.has(swapAssetKey(asset));
  };

  const preference = (asset: SwapAsset) =>
    asset.chainId === from?.chainId ? -1 : SWAP_CHAIN_IDS.indexOf(asset.chainId);

  const rows: SwapAssetRow[] = [];
  for (const members of groupBy(assets.filter(canBecome)).values()) {
    const sorted = [...members].sort(
      (a, b) => preference(a) - preference(b) || b.balanceUsd - a.balanceUsd,
    );
    const [asset] = sorted;
    const identity = assetIdentity(asset);
    // Fuse's USDC is the one the card and Send spend; say so where it's offered.
    const description =
      identity.name === 'USDC' && asset.chainId === fuse.id
        ? 'Dollar coin · card and Send use it'
        : describe(identity, asset);
    const crossChain = !!from && asset.chainId !== from.chainId;
    rows.push({
      key: identity.key,
      name: identity.name,
      subtitle: crossChain
        ? `${description} · arrives on ${chainName(asset.chainId)}`
        : description,
      category: identity.category,
      asset,
      members: sorted,
      balance: asset.balance,
      balanceUsd: asset.balanceUsd,
    });
  }

  return bySection(
    rows.filter(row => matches(row, query)).sort((a, b) => listOrder(a) - listOrder(b)),
  );
}

/**
 * The line under the fee: what this plan pays and what the others would.
 * Rates for the others are the published table; this plan's is the live one
 * the fee row already shows.
 */
export function swapFeeFootnote(tierName: string | undefined): string | undefined {
  const primeRate =
    fallbackTierFees(RewardsTier.PRIME).lines.find(line => line.key === 'swap')?.rate ?? 0;
  switch (tierName?.toLowerCase()) {
    case RewardsTier.CORE:
      return `Core plan fee. Prime pays ${formatFeeValue(primeRate)}, Ultra pays nothing.`;
    case RewardsTier.PRIME:
      return 'Prime plan fee. Ultra pays nothing.';
    case RewardsTier.ULTRA:
      return 'Ultra pays no swap fee.';
    default:
      return undefined;
  }
}
