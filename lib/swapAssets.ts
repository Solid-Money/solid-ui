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

/** Earn's products, in the order Earn lists them; the ones off the swap list too. */
const EARN_PRODUCTS = ['USD Yield', 'FUSE Yield', 'ETH Yield', 'EUR Yield'];

/** A row's place within its section, after the rows that can be tapped. */
const listOrder = (row: SwapAssetRow) =>
  LIST_ORDER.get(row.name) ?? SWAP_LIST.length + EARN_PRODUCTS.indexOf(row.name);

const byReadiness = (a: SwapAssetRow, b: SwapAssetRow) =>
  Number(a.disabled) - Number(b.disabled) ||
  b.balanceUsd - a.balanceUsd ||
  listOrder(a) - listOrder(b);

/** On the swap list, and in this environment's catalogue so the backend quotes it. */
const onList = (asset: SwapAssetWithBalance) => asset.swappable && !!swapListing(asset);

/**
 * One row per asset `assets` has that isn't in `taken` yet: what's on the swap
 * list, and each of Earn's products. Greyed, for the pickers to show the whole
 * list, `subtitle` saying why each can't be picked.
 */
function remainingRows(
  assets: SwapAssetWithBalance[],
  taken: ReadonlySet<string>,
  subtitle: (asset: SwapAssetWithBalance, listed: boolean) => string,
): SwapAssetRow[] {
  const rows: SwapAssetRow[] = [];
  const universe = assets.filter(
    asset => onList(asset) || EARN_PRODUCTS.includes(assetIdentity(asset).name),
  );
  for (const members of groupBy(universe).values()) {
    const sorted = [...members].sort(
      (a, b) =>
        Number(onList(b)) - Number(onList(a)) ||
        SWAP_CHAIN_IDS.indexOf(a.chainId) - SWAP_CHAIN_IDS.indexOf(b.chainId),
    );
    const [asset] = sorted;
    const identity = assetIdentity(asset);
    if (taken.has(identity.key)) continue;
    rows.push({
      key: identity.key,
      name: identity.name,
      subtitle: subtitle(asset, onList(asset)),
      category: identity.category,
      asset,
      members: [asset],
      balance: 0,
      balanceUsd: 0,
      disabled: true,
    });
  }
  return rows;
}

/**
 * "You pay": the whole swap list, one row per asset. What the user holds comes
 * first, every network holding it among its `members`; the rest is greyed.
 * Earn shows each of its products, greyed where it's withdrawn in Earn rather
 * than swapped. Any other holding sits at the bottom under "Can't be swapped
 * yet", one row per network so it's clear which.
 */
export function payAssetSections(
  assets: SwapAssetWithBalance[],
  { query = '', chainName }: { query?: string; chainName: ChainName },
): SwapAssetSection[] {
  const held = assets.filter(asset => asset.balance > 0);
  const rows: SwapAssetRow[] = [];
  // Assets that already have a row, so the rest of the list doesn't repeat them.
  const taken = new Set<string>();

  for (const members of groupBy(held.filter(onList)).values()) {
    const sorted = [...members].sort(byValue);
    const [asset] = sorted;
    const identity = assetIdentity(asset);
    const subtitle =
      sorted.length > 1
        ? `On ${sorted.length} networks`
        : asset.chainId !== fuse.id
          ? `On ${chainName(asset.chainId)}`
          : describe(identity, asset);
    taken.add(identity.key);
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
  for (const asset of held.filter(member => !onList(member))) {
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
    if (identity.isYield && !lookalike) {
      taken.add(identity.key);
      rows.push(row);
    } else blocked.push(row);
  }

  rows.push(
    ...remainingRows(assets, taken, (_asset, listed) =>
      listed ? 'You don’t have any' : 'Deposit and withdraw it in Earn',
    ),
  );

  return [
    ...bySection(rows.filter(row => matches(row, query)).sort(byReadiness)),
    ...section(
      'blocked',
      'Can’t be swapped yet',
      blocked.filter(row => matches(row, query)).sort((a, b) => b.balanceUsd - a.balanceUsd),
    ),
  ];
}

/**
 * "You get": the whole swap list, one row per asset, in the list's order. An
 * asset the "You pay" one can become can be picked, arriving on the network
 * quickest to reach: the same one when it's there, then in `SWAP_CHAIN_IDS`
 * order, every reachable network among its `members`. The rest is greyed with
 * why. Only pairs `isSwapRouteOpen` allows can be picked.
 *
 * `reachable` is the backend's answer for the "You pay" token, as
 * `chainId:address` keys. Null while it loads or when it couldn't be read: the
 * pairs `isSwapRouteOpen` allows are offered and the quote has the last word.
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
  const fromName = from ? `${assetDisplayName(from)} on ${chainName(from.chainId)}` : '';
  const isFrom = (asset: SwapAsset) => swapAssetKey(asset) === fromKey;
  const canBecome = (asset: SwapAssetWithBalance) => {
    if (!onList(asset) || isFrom(asset)) return false;
    if (!from) return true;
    if (!isSwapRouteOpen(from, asset)) return false;
    // A Fuse coin reaches every Fuse coin through Algebra, and Solid's bridge
    // carries its own pairs; the backend's route map is LI.FI's and speaks for
    // neither.
    const onAlgebra = from.chainId === fuse.id && asset.chainId === fuse.id;
    return (
      !reachable ||
      onAlgebra ||
      !!solidBridgeRoute(from, asset) ||
      reachable.has(swapAssetKey(asset))
    );
  };

  const preference = (asset: SwapAsset) =>
    asset.chainId === from?.chainId ? -1 : SWAP_CHAIN_IDS.indexOf(asset.chainId);

  const rows: SwapAssetRow[] = [];
  const taken = new Set<string>();
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
    taken.add(identity.key);
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

  rows.push(
    ...remainingRows(assets, taken, (asset, listed) => {
      if (!listed) return 'Deposit it in Earn instead';
      if (!from) return 'Can’t be swapped right now';
      // Only on the paying coin's own network: it is the coin being paid with.
      if (groupBy(assets.filter(onList)).get(assetIdentity(asset).key)?.every(isFrom)) {
        return 'You’re paying with this';
      }
      return `Not with ${fromName} yet`;
    }),
  );

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
