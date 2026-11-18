import { WNATIVE } from '@cryptoalgebra/fuse-sdk';
import { zeroAddress } from 'viem';

import { isSwapPairOpen, SWAP_LIST } from '@/constants/swapChains';
import { PRODUCTION_VAULT_ADDRESSES } from '@/lib/config';
import {
  assetDisplayName,
  getAssetRows,
  matchesSwapAsset,
  payAssetRows,
  SwapAssetRow,
  swapFeeFootnote,
} from '@/lib/swapAssets';
import { SwapAssetWithBalance } from '@/lib/types/lifi-swap';

const FUSE = 122;
const BASE = 8453;
const ETHEREUM = 1;
const BSC = 56;
const ARBITRUM = 42161;
const POLYGON = 137;

/** The row a symbol joins on the swap list, where that isn't the symbol itself. */
const LIST_NAME: Record<string, string> = {
  USDCe: 'USDC',
  soUSD: 'USD Yield',
  soFUSE: 'FUSE Yield',
};

let next = 1;
const fresh = () => `0x${(next++).toString(16).padStart(40, '0')}` as `0x${string}`;
const listedAt = (symbol: string, chainId: number) =>
  SWAP_LIST.find(
    listing => listing.chainId === chainId && listing.name === (LIST_NAME[symbol] ?? symbol),
  )?.address ?? fresh();

/** A coin at its swap-list address when it has one, a made-up one when not. */
const asset = (
  symbol: string,
  chainId: number,
  balance = 0,
  overrides: Partial<SwapAssetWithBalance> = {},
): SwapAssetWithBalance => {
  const address = overrides.address ?? listedAt(symbol, chainId);
  return {
    chainId,
    address,
    symbol,
    name: symbol,
    decimals: 6,
    isNative: address === zeroAddress,
    balance,
    balanceRaw: BigInt(Math.round(balance * 1e6)),
    balanceUsd: balance,
    priceUsd: 1,
    swappable: true,
    ...overrides,
  };
};

const keys = (rows: SwapAssetRow[]) => rows.map(row => row.key);

const key = (a: SwapAssetWithBalance) => `${a.chainId}:${a.address.toLowerCase()}`;

describe('the route matrix', () => {
  it('swaps Fuse with Fuse, and Ethereum, Base and BNB Chain among themselves', () => {
    expect(isSwapPairOpen(FUSE, FUSE)).toBe(true);
    expect(isSwapPairOpen(BASE, BASE)).toBe(true);
    expect(isSwapPairOpen(BASE, ETHEREUM)).toBe(true);
    expect(isSwapPairOpen(BSC, BASE)).toBe(true);
  });

  it('swaps Fuse with Ethereum, Base and BNB Chain both ways', () => {
    for (const other of [ETHEREUM, BASE, BSC]) {
      expect(isSwapPairOpen(FUSE, other)).toBe(true);
      expect(isSwapPairOpen(other, FUSE)).toBe(true);
    }
  });

  it('leaves Arbitrum and Polygon out, Fuse included', () => {
    expect(isSwapPairOpen(FUSE, ARBITRUM)).toBe(false);
    expect(isSwapPairOpen(ARBITRUM, FUSE)).toBe(false);
    expect(isSwapPairOpen(POLYGON, FUSE)).toBe(false);
    expect(isSwapPairOpen(ARBITRUM, BASE)).toBe(false);
    expect(isSwapPairOpen(ARBITRUM, ARBITRUM)).toBe(false);
  });
});

describe('You pay', () => {
  const usdcFuse = asset('USDCe', FUSE, 30);
  const usdcBase = asset('USDC', BASE, 12.1);
  const usdt = asset('USDT', FUSE, 5);
  const eurc = asset('EURC', BASE, 8);
  const usdYield = asset('soUSD', FUSE, 18.43, { balanceUsd: 19.94 });
  const fuseNative = asset('FUSE', FUSE, 145, { balanceUsd: 1.2 });
  const wfuse = asset('WFUSE', FUSE, 10, { balanceUsd: 0.1 });
  const ethBase = asset('ETH', BASE, 0.0081, { balanceUsd: 31.46 });
  // Held, but not on the swap list.
  const usdYieldBase = asset('soUSD', BASE, 5, { swappable: false, balanceUsd: 5.41 });
  const usdcArbitrum = asset('USDC', ARBITRUM, 3);
  const ethYield = asset('soETH', FUSE, 2);
  const oldUsdc = asset('USDC', FUSE, 1, {
    address: fresh(),
    name: 'Fuse Bridged USDC (Deprecated)',
  });
  const bridgedFuse = asset('FUSE', BASE, 50, { balanceUsd: 0.4 });
  const notHeld = asset('EURC', ETHEREUM, 0);

  const rows = payAssetRows([
    usdcFuse,
    usdcBase,
    usdt,
    eurc,
    usdYield,
    fuseNative,
    wfuse,
    ethBase,
    usdYieldBase,
    usdcArbitrum,
    ethYield,
    oldUsdc,
    bridgedFuse,
    notHeld,
  ]);

  it('orders the joined list by total held value across categories', () => {
    expect(keys(rows)).toEqual(['USDC', 'ETH', 'USD Yield', 'EURC', 'USDT', 'FUSE', 'WFUSE']);
  });

  it('groups USDC under its display name with its canonical ticker', () => {
    const usdc = rows[0];
    expect(usdc).toMatchObject({
      name: 'USD Coin',
      symbol: 'USDC',
      category: 'stablecoins',
      asset: usdcFuse,
      members: [usdcFuse, usdcBase],
    });
    expect(usdc.balanceUsd).toBeCloseTo(42.1);
  });

  it('leaves out holdings the swap can’t take: Earn shares withdrawn in Earn, other networks, old coins', () => {
    const shown = rows.flatMap(row => row.members);
    for (const unswappable of [usdYieldBase, usdcArbitrum, ethYield, oldUsdc, bridgedFuse]) {
      expect(shown).not.toContain(unswappable);
    }
  });

  it('leaves out what isn’t held, the rest of the list and Earn included', () => {
    const rows = payAssetRows([
      asset('USDT', FUSE, 0),
      usdcFuse,
      asset('soFUSE', FUSE, 0),
      asset('soEURC', BASE, 0, { swappable: false }),
      usdYield,
      notHeld,
    ]);
    expect(keys(rows)).toEqual(['USDC', 'USD Yield']);
  });

  it('shows nothing when nothing held can be swapped', () => {
    expect(payAssetRows([usdcArbitrum, ethYield, notHeld])).toEqual([]);
  });

  it('searches by display name, ticker, and the underlying token metadata', () => {
    expect(keys(rows.filter(row => matchesSwapAsset(row, 'USD Coin')))).toEqual(['USDC']);
    expect(keys(rows.filter(row => matchesSwapAsset(row, 'usdce')))).toEqual(['USDC']);
    expect(keys(rows.filter(row => matchesSwapAsset(row, 'sousd')))).toEqual(['USD Yield']);
  });
});

describe('You get', () => {
  // One of everything on the list, plus coins it leaves out.
  const listed = SWAP_LIST.map(listing =>
    asset(listing.name, listing.chainId, 0, {
      address: listing.address,
      symbol: listing.name === 'USDC' && listing.chainId === FUSE ? 'USDCe' : listing.name,
    }),
  );
  const find = (name: string, chainId: number) =>
    listed.find(a => a.chainId === chainId && listedAt(name, chainId) === a.address)!;
  const unlisted = [
    asset('soETH', FUSE),
    asset('FUSE', BASE),
    asset('soUSD', ETHEREUM),
    asset('ETH', ETHEREUM, 0, { address: zeroAddress }),
    asset('USDC', ARBITRUM),
    asset('VOLT', FUSE),
  ];
  const all = [...listed, ...unlisted];
  const offered = getAssetRows;

  it('lists only what the paying coin can become, nothing off the swap list', () => {
    const from = find('USDC', FUSE);
    const rows = offered(all, { from, reachable: null });
    expect(keys(rows)).toEqual([
      'USDC',
      'USDT',
      'EURC',
      'USD Yield',
      'FUSE Yield',
      'FUSE',
      'WFUSE',
      'ETH',
      'WETH',
      'cbBTC',
      'WBTC',
      'AAVE',
      'ENA',
      'SOL',
      'UNI',
    ]);
    expect(rows.find(row => row.key === 'EURC')).toMatchObject({
      name: 'Euro Coin',
      symbol: 'EURC',
    });
    expect(rows.find(row => row.key === 'ETH')).toMatchObject({ name: 'Ethereum', symbol: 'ETH' });
  });

  it('leaves out the coin being paid with when it is on no other network', () => {
    const from = find('FUSE', FUSE);
    const names = keys(offered(all, { from, reachable: null }));
    expect(names).not.toContain('FUSE');
    expect(names).toContain('WFUSE');
  });

  it('offers Base, Ethereum and BNB Chain coins for a Fuse coin, the Fuse one first', () => {
    const from = find('soUSD', FUSE);
    const rows = offered(all, { from, reachable: null });
    expect(keys(rows)).toEqual([
      'USDC',
      'USDT',
      'EURC',
      'FUSE Yield',
      'FUSE',
      'WFUSE',
      'ETH',
      'WETH',
      'cbBTC',
      'WBTC',
      'AAVE',
      'ENA',
      'SOL',
      'UNI',
    ]);
    const [usdc, , eurc] = rows;
    expect(usdc.members).toEqual([
      find('USDC', FUSE),
      find('USDC', BASE),
      find('USDC', ETHEREUM),
      find('USDC', BSC),
    ]);
    expect(eurc).toMatchObject({
      asset: find('EURC', BASE),
      name: 'Euro Coin',
    });
  });

  it('offers WFUSE and the other networks’ coins for FUSE', () => {
    const from = find('FUSE', FUSE);
    const crypto = offered(all, { from, reachable: null }).filter(row => row.category === 'crypto');
    expect(keys(crypto)).toEqual([
      'WFUSE',
      'ETH',
      'WETH',
      'cbBTC',
      'WBTC',
      'AAVE',
      'ENA',
      'SOL',
      'UNI',
    ]);
  });

  // The flow hands FUSE to WFUSE to the old wrap form when "You get" is the
  // router's wrapped FUSE, so the listed WFUSE has to be that token.
  it('lists the WFUSE the wrap form takes', () => {
    const wfuse = SWAP_LIST.find(listing => listing.name === 'WFUSE');
    expect(wfuse?.address.toLowerCase()).toBe(WNATIVE[FUSE].address.toLowerCase());
  });

  it('offers Fuse coins for a Base coin, Earn included, and the other networks', () => {
    const from = find('USDC', BASE);
    const rows = offered(all, { from, reachable: null });
    expect(keys(rows)).toEqual([
      'USDC',
      'USDT',
      'EURC',
      'USD Yield',
      'FUSE Yield',
      'FUSE',
      'WFUSE',
      'ETH',
      'WETH',
      'cbBTC',
      'WBTC',
      'AAVE',
      'ENA',
      'SOL',
      'UNI',
    ]);
    const [usdc, usdt, eurc] = rows;
    expect(usdc.members).toEqual([find('USDC', FUSE), find('USDC', ETHEREUM), find('USDC', BSC)]);
    expect(usdt.asset).toBe(find('USDT', BASE));
    expect(usdt.members).toContain(find('USDT', FUSE));
    expect(eurc.asset).toBe(find('EURC', BASE));
  });

  it('delivers on the paying network when it can, then Fuse, then Base before Ethereum', () => {
    const from = find('USDT', BSC);
    const rows = offered(all, { from, reachable: null });
    const stablecoins = rows.filter(row => row.category === 'stablecoins');
    expect(stablecoins.map(row => row.asset)).toEqual([
      find('USDC', BSC),
      find('USDT', FUSE),
      find('EURC', BASE),
    ]);
    expect(rows.find(row => row.key === 'ETH')?.asset).toBe(find('ETH', BASE));
  });

  it('keeps to the backend’s routes off Fuse once it has them, and offers Fuse whatever they say', () => {
    const from = find('ETH', BASE);
    const reachable = new Set([key(find('USDT', BASE)), key(find('EURC', ETHEREUM))]);
    const rows = offered(all, { from, reachable });
    expect(keys(rows)).toEqual([
      'USDC',
      'USDT',
      'EURC',
      'USD Yield',
      'FUSE Yield',
      'FUSE',
      'WFUSE',
    ]);
    const row = (key: string) => rows.find(candidate => candidate.key === key)!;
    // LI.FI's map has no route to USDC off Fuse, so it arrives on Fuse.
    expect(row('USDC').members).toEqual([find('USDC', FUSE)]);
    expect(row('USDT').asset).toBe(find('USDT', BASE));
    expect(row('EURC').asset).toBe(find('EURC', ETHEREUM));
    expect(row('WETH')).toBeUndefined();
  });

  it('keeps to the backend’s list off Fuse for a Fuse coin, and offers every Fuse coin', () => {
    const from = find('USDC', FUSE);
    // What a sponsored swap delivers off Fuse: USDC, ETH on Base, USDT off Base.
    const reachable = new Set(
      [
        find('USDC', BASE),
        find('USDC', ETHEREUM),
        find('USDC', BSC),
        find('USDT', ETHEREUM),
        find('USDT', BSC),
        find('ETH', BASE),
      ].map(key),
    );
    const rows = offered(all, { from, reachable });
    expect(keys(rows)).toEqual(['USDC', 'USDT', 'USD Yield', 'FUSE Yield', 'FUSE', 'WFUSE', 'ETH']);
    const [usdc, usdt] = rows;
    expect(usdc.members).toEqual([find('USDC', BASE), find('USDC', ETHEREUM), find('USDC', BSC)]);
    expect(usdt.asset).toBe(find('USDT', FUSE));
    expect(usdt.members).not.toContain(find('USDT', BASE));
  });

  it('offers only Fuse coins for a Fuse coin that can’t leave Fuse', () => {
    const from = find('FUSE Yield', FUSE);
    const rows = offered(all, { from, reachable: new Set<string>() });
    expect(keys(rows)).toEqual(['USDC', 'USDT', 'USD Yield', 'FUSE', 'WFUSE']);
    for (const row of rows) {
      expect(row.members.every(member => member.chainId === FUSE)).toBe(true);
    }
  });
});

describe('names and fee copy', () => {
  it('calls a share token by its product', () => {
    expect(assetDisplayName({ symbol: 'soUSD' })).toBe('USD Yield');
    expect(assetDisplayName({ symbol: 'USDCe' })).toBe('USDC');
  });

  it('names the canonical Fuse USD Yield contract by its listing for any ticker', () => {
    expect(
      assetDisplayName({
        symbol: 'fUSDC',
        chainId: FUSE,
        address: PRODUCTION_VAULT_ADDRESSES.fuse.vault,
      }),
    ).toBe('USD Yield');
  });

  it('explains the plan fee', () => {
    expect(swapFeeFootnote('core')).toBe('Core plan fee. Prime pays 0.25%, Ultra pays nothing.');
    expect(swapFeeFootnote('ultra')).toBe('Ultra pays no swap fee.');
    expect(swapFeeFootnote(undefined)).toBeUndefined();
  });
});
