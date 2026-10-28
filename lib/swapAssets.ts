import { fuse } from 'viem/chains';

import { fallbackTierFees, formatFeeValue } from '@/components/Rewards/NewRewards/tierFees';
import { RewardsTier } from '@/lib/types';
import { SwapAsset, SwapAssetWithBalance } from '@/lib/types/lifi-swap';

/**
 * The swap pickers list assets, not contracts: USDC is one row however many
 * networks it is held on, and soUSD is "USD Yield". The network is picked for
 * the user (the one holding most on "You pay", the quickest to arrive on "You
 * get") and named only where it matters.
 */

export type SwapAssetCategory = 'stablecoins' | 'euro' | 'earn' | 'crypto';

/** Share tokens, by the product they are. Matched on symbol: the list is curated. */
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

const DOLLAR_COINS = new Set(['USDC', 'USDT', 'DAI', 'USDS', 'PYUSD', 'FDUSD', 'USDe']);
const EURO_COINS = new Set(['EURC', 'EURe', 'EURS', 'EURA']);

const DESCRIPTIONS: Record<string, string> = {
  USDC: 'Dollar coin',
  USDT: 'Dollar coin',
  DAI: 'Dollar coin',
  EURC: 'Euro coin',
  FUSE: 'Fuse token',
  ETH: 'Ether',
  WETH: 'Wrapped Ether',
  BNB: 'BNB',
  POL: 'Polygon',
};

/** What "You get" lists first, in this order. */
const POPULAR = ['USDC', 'USDT', 'FUSE'];

export interface SwapAssetIdentity {
  /** One row per key. */
  key: string;
  /** "USD Yield", "USDC", "ETH". */
  name: string;
  category: SwapAssetCategory;
  isYield: boolean;
}

export function assetIdentity(asset: Pick<SwapAsset, 'symbol'>): SwapAssetIdentity {
  const product = YIELD_PRODUCTS[asset.symbol];
  if (product) return { key: product, name: product, category: 'earn', isYield: true };
  const name = SAME_ASSET[asset.symbol] ?? asset.symbol;
  const category: SwapAssetCategory = DOLLAR_COINS.has(name)
    ? 'stablecoins'
    : EURO_COINS.has(name)
      ? 'euro'
      : 'crypto';
  return { key: name, name, category, isYield: false };
}

/** "USD Yield", "USDC": how the screens name an asset, never its share token. */
export const assetDisplayName = (asset: Pick<SwapAsset, 'symbol'>) => assetIdentity(asset).name;

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

/**
 * "You pay": what the user holds, one row per asset, paying from the network
 * holding most of it. A holding the backend won't quote sits at the bottom
 * under "Can't be swapped yet", one row per network so it's clear which.
 */
export function payAssetSections(
  assets: SwapAssetWithBalance[],
  { query = '', chainName }: { query?: string; chainName: ChainName },
): SwapAssetSection[] {
  const held = assets.filter(asset => asset.balance > 0);
  const rows: SwapAssetRow[] = [];

  for (const members of groupBy(held.filter(asset => asset.swappable)).values()) {
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

  const blocked: SwapAssetRow[] = held
    .filter(asset => !asset.swappable)
    .map(asset => {
      const identity = assetIdentity(asset);
      return {
        key: `blocked:${asset.chainId}:${asset.address.toLowerCase()}`,
        name: `${identity.name} on ${chainName(asset.chainId)}`,
        subtitle: identity.isYield ? 'Withdraw it in Earn instead' : 'Not on the swap list yet',
        category: identity.category,
        asset,
        members: [asset],
        balance: asset.balance,
        balanceUsd: asset.balanceUsd,
        disabled: true,
      };
    });

  const visible = rows
    .filter(row => matches(row, query))
    .sort((a, b) => b.balanceUsd - a.balanceUsd);
  const inCategory = (...categories: SwapAssetCategory[]) =>
    visible.filter(row => categories.includes(row.category));

  return [
    ...section('stablecoins', 'Stablecoins', inCategory('stablecoins', 'euro')),
    ...section('earn', 'Earn', inCategory('earn')),
    ...section('crypto', 'Crypto', inCategory('crypto')),
    ...section(
      'blocked',
      'Can’t be swapped yet',
      blocked.filter(row => matches(row, query)).sort((a, b) => b.balanceUsd - a.balanceUsd),
    ),
  ];
}

/**
 * "You get": every asset the "You pay" one can become, one row each, arriving
 * on the network quickest to reach: the same one when it's there, then Fuse.
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
  const fromKey = from ? `${from.chainId}:${from.address.toLowerCase()}` : undefined;
  const candidates = assets.filter(asset => {
    if (!asset.swappable) return false;
    const key = `${asset.chainId}:${asset.address.toLowerCase()}`;
    if (key === fromKey) return false;
    // A Fuse coin reaches every Fuse coin through Algebra, imported ones
    // included, which the backend's list doesn't know about.
    const onAlgebra = from?.chainId === fuse.id && asset.chainId === fuse.id;
    return !reachable || onAlgebra || reachable.has(key);
  });

  const preference = (asset: SwapAsset) =>
    asset.chainId === from?.chainId ? 0 : asset.chainId === fuse.id ? 1 : 2;

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

  const visible = rows.filter(row => matches(row, query));
  const popular = POPULAR.flatMap(name => visible.filter(row => row.name === name));
  const rest = visible.filter(row => !POPULAR.includes(row.name));
  const inCategory = (category: SwapAssetCategory) =>
    rest.filter(row => row.category === category).sort((a, b) => a.name.localeCompare(b.name));

  return [
    ...section('popular', 'Popular', popular),
    ...section('stablecoins', 'Stablecoins', inCategory('stablecoins')),
    ...section('euro', 'Euro', inCategory('euro')),
    ...section('earn', 'Earn', inCategory('earn')),
    ...section('crypto', 'Crypto', inCategory('crypto')),
  ];
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
