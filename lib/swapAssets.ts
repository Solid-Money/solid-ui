import { fuse } from 'viem/chains';

import { fallbackTierFees, formatFeeValue } from '@/components/Rewards/NewRewards/tierFees';
import {
  isSwapRouteOpen,
  solidBridgeRoute,
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
  /** Shown greyed and can't be tapped. */
  disabled: boolean;
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

/**
 * "You pay": what the user holds of the swap list, one row per asset, every
 * network holding it among its `members`. Earn shows every yield position,
 * greyed where it's withdrawn in Earn rather than swapped. Any other holding
 * sits at the bottom under "Can't be swapped yet", one row per network so it's
 * clear which.
 */
export function payAssetSections(
  assets: SwapAssetWithBalance[],
  { query = '', chainName }: { query?: string; chainName: ChainName },
): SwapAssetSection[] {
  const held = assets.filter(asset => asset.balance > 0);
  const payable = (asset: SwapAssetWithBalance) => asset.swappable && !!swapListing(asset);
  const rows: SwapAssetRow[] = [];

  for (const members of groupBy(held.filter(payable)).values()) {
    const sorted = [...members].sort(byValue);
    const [asset] = sorted;
    const identity = assetIdentity(asset);
    const subtitle =
      sorted.length > 1
        ? `On ${sorted.length} networks`
        : asset.chainId !== fuse.id
          ? `On ${chainName(asset.chainId)}`
          : (DESCRIPTIONS[identity.name] ?? asset.name);
    rows.push({
      key: identity.key,
      name: identity.name,
      subtitle,
      category: identity.category,
      asset,
      members: sorted,
      balance: sorted.reduce((sum, member) => sum + member.balance, 0),
      balanceUsd: sorted.reduce((sum, member) => sum + member.balanceUsd, 0),
      disabled: false,
    });
  }

  const blocked: SwapAssetRow[] = [];
  for (const asset of held.filter(member => !payable(member))) {
    const identity = assetIdentity(asset);
    // An old version of a listed coin, like Fuse's deprecated bridged USDC,
    // goes by its own name so it isn't read as the one that swaps.
    const lookalike =
      !swapListing(asset) &&
      SWAP_LIST.some(
        listing => listing.chainId === asset.chainId && listing.name === identity.name,
      );
    const row: SwapAssetRow = {
      key: `blocked:${swapAssetKey(asset)}`,
      name: lookalike ? asset.name : `${identity.name} on ${chainName(asset.chainId)}`,
      subtitle: identity.isYield ? 'Withdraw it in Earn instead' : 'Not on the swap list yet',
      category: identity.category,
      asset,
      members: [asset],
      balance: asset.balance,
      balanceUsd: asset.balanceUsd,
      disabled: true,
    };
    if (identity.isYield && !lookalike) rows.push(row);
    else blocked.push(row);
  }

  const visible = rows
    .filter(row => matches(row, query))
    .sort((a, b) => Number(a.disabled) - Number(b.disabled) || b.balanceUsd - a.balanceUsd);

  return [
    ...bySection(visible),
    ...section(
      'blocked',
      'Can’t be swapped yet',
      blocked.filter(row => matches(row, query)).sort((a, b) => b.balanceUsd - a.balanceUsd),
    ),
  ];
}

/**
 * "You get": every asset on the swap list the "You pay" one can become, one
 * row each, arriving on the network quickest to reach: the same one when it's
 * there, then in `SWAP_CHAIN_IDS` order. Only pairs `isSwapRouteOpen` allows.
 *
 * `reachable` is the backend's answer for the "You pay" token, as
 * `chainId:address` keys. Null while it loads or when it couldn't be read: the
 * whole swap list is offered and the quote has the last word.
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
  const candidates = assets.filter(asset => {
    if (!asset.swappable || !swapListing(asset)) return false;
    const key = swapAssetKey(asset);
    if (key === fromKey) return false;
    if (from && !isSwapRouteOpen(from, asset)) return false;
    // A Fuse coin reaches every Fuse coin through Algebra, and Solid's bridge
    // carries its own pairs; the backend's route map is LI.FI's and speaks for
    // neither.
    const onAlgebra = from?.chainId === fuse.id && asset.chainId === fuse.id;
    const onBridge = !!from && !!solidBridgeRoute(from, asset);
    return !reachable || onAlgebra || onBridge || reachable.has(key);
  });

  const preference = (asset: SwapAsset) =>
    asset.chainId === from?.chainId ? -1 : SWAP_CHAIN_IDS.indexOf(asset.chainId);

  const rows: SwapAssetRow[] = [];
  for (const members of groupBy(candidates).values()) {
    const sorted = [...members].sort(
      (a, b) => preference(a) - preference(b) || b.balanceUsd - a.balanceUsd,
    );
    const [asset] = sorted;
    const identity = assetIdentity(asset);
    // Fuse's USDC is the one the card and Send spend; say so where it's offered.
    const description =
      identity.name === 'USDC' && asset.chainId === fuse.id
        ? 'Dollar coin · card and Send use it'
        : identity.isYield
          ? `Earn on ${identity.name.replace(' Yield', '')}`
          : (DESCRIPTIONS[identity.name] ?? asset.name);
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
      disabled: false,
    });
  }

  const visible = rows
    .filter(row => matches(row, query))
    .sort((a, b) => (LIST_ORDER.get(a.name) ?? 0) - (LIST_ORDER.get(b.name) ?? 0));
  return bySection(visible);
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
