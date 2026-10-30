import { WNATIVE } from '@cryptoalgebra/fuse-sdk';
import { zeroAddress } from 'viem';

import { isSwapPairOpen, SWAP_LIST } from '@/constants/swapChains';
import { ADDRESSES } from '@/lib/config';
import {
  assetDisplayName,
  getAssetSections,
  payAssetSections,
  swapFeeFootnote,
} from '@/lib/swapAssets';
import { SwapAssetWithBalance } from '@/lib/types/lifi-swap';

const FUSE = 122;
const BASE = 8453;
const ETHEREUM = 1;
const BSC = 56;
const ARBITRUM = 42161;

const NAMES: Record<number, string> = {
  [FUSE]: 'Fuse',
  [BASE]: 'Base',
  [ETHEREUM]: 'Ethereum',
  [BSC]: 'BNB Chain',
  [ARBITRUM]: 'Arbitrum',
};
const chainName = (id: number) => NAMES[id] ?? String(id);

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

const titles = (sections: { title: string; rows: { name: string }[] }[]) =>
  sections.map(section => `${section.title}: ${section.rows.map(row => row.name).join(', ')}`);

const key = (a: SwapAssetWithBalance) => `${a.chainId}:${a.address.toLowerCase()}`;

describe('the route matrix', () => {
  it('swaps Fuse with Fuse, and Ethereum, Base and BNB Chain among themselves', () => {
    expect(isSwapPairOpen(FUSE, FUSE)).toBe(true);
    expect(isSwapPairOpen(BASE, BASE)).toBe(true);
    expect(isSwapPairOpen(BASE, ETHEREUM)).toBe(true);
    expect(isSwapPairOpen(BSC, BASE)).toBe(true);
  });

  it('keeps Fuse apart from other networks, and leaves the rest out', () => {
    expect(isSwapPairOpen(FUSE, BASE)).toBe(false);
    expect(isSwapPairOpen(ETHEREUM, FUSE)).toBe(false);
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

  const sections = payAssetSections(
    [
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
    ],
    { chainName },
  );

  it('groups held coins from the swap list, euros with the dollars, and WFUSE with crypto', () => {
    expect(titles(sections)).toEqual([
      'Stablecoins: USDC, EURC, USDT',
      'Earn: USD Yield',
      'Crypto: ETH, FUSE, WFUSE',
      'Can’t be swapped yet: USD Yield on Base, USDC on Arbitrum, ETH Yield on Fuse, ' +
        'Fuse Bridged USDC (Deprecated), FUSE on Base',
    ]);
  });

  it('counts USDC across networks and pays from the one holding most', () => {
    const usdc = sections[0].rows[0];
    expect(usdc.subtitle).toBe('On 2 networks');
    expect(usdc.asset).toBe(usdcFuse);
    expect(usdc.members).not.toContain(oldUsdc);
    expect(usdc.balanceUsd).toBeCloseTo(42.1);
  });

  it('names the network of a coin held only off Fuse', () => {
    expect(sections[2].rows[0].subtitle).toBe('On Base');
  });

  it('greys out what the list leaves out, and says where a yield share goes', () => {
    const [yieldRow, arbitrumRow] = sections[3].rows;
    expect(sections[3].rows.every(row => row.disabled)).toBe(true);
    expect(yieldRow.subtitle).toBe('Withdraw it in Earn instead');
    expect(arbitrumRow.subtitle).toBe('Not on the swap list yet');
  });

  it('searches by product name and by symbol', () => {
    expect(titles(payAssetSections([usdYield, usdt], { chainName, query: 'yield' }))).toEqual([
      'Earn: USD Yield',
    ]);
    expect(titles(payAssetSections([usdYield, usdt], { chainName, query: 'sousd' }))).toEqual([
      'Earn: USD Yield',
    ]);
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

  it('offers every Fuse coin for a Fuse coin, and nothing elsewhere', () => {
    const from = find('soUSD', FUSE);
    expect(titles(getAssetSections(all, { from, reachable: null, chainName }))).toEqual([
      'Stablecoins: USDC, USDT',
      'Earn: FUSE Yield',
      'Crypto: FUSE, WFUSE',
    ]);
  });

  it('offers WFUSE for any Fuse coin, FUSE included', () => {
    const from = find('FUSE', FUSE);
    const crypto = getAssetSections(all, { from, reachable: null, chainName }).find(
      section => section.key === 'crypto',
    );
    expect(crypto?.rows.map(row => row.name)).toEqual(['WFUSE']);
  });

  // The flow hands FUSE to WFUSE to the old wrap form when "You get" is the
  // router's wrapped FUSE, so the listed WFUSE has to be that token.
  it('lists the WFUSE the wrap form takes', () => {
    const wfuse = SWAP_LIST.find(listing => listing.name === 'WFUSE');
    expect(wfuse?.address.toLowerCase()).toBe(WNATIVE[FUSE].address.toLowerCase());
  });

  it('offers Ethereum, Base and BNB Chain coins for a Base coin, crypto on Base only', () => {
    const from = find('USDC', BASE);
    const sections = getAssetSections(all, { from, reachable: null, chainName });
    expect(titles(sections)).toEqual([
      'Stablecoins: USDC, USDT, EURC',
      'Crypto: ETH, WETH, cbBTC, WBTC, AAVE, ENA, SOL, UNI',
    ]);
    const [usdc, usdt, eurc] = sections[0].rows;
    expect(usdc.asset).toBe(find('USDC', ETHEREUM));
    expect(usdc.subtitle).toBe('Dollar coin · arrives on Ethereum');
    expect(usdt.asset).toBe(find('USDT', BASE));
    expect(usdt.subtitle).toBe('Dollar coin');
    expect(eurc.asset).toBe(find('EURC', BASE));
  });

  it('delivers on the paying network when it can, then Base before Ethereum', () => {
    const from = find('USDT', BSC);
    const [stablecoins, crypto] = getAssetSections(all, { from, reachable: null, chainName });
    expect(stablecoins.rows.map(row => row.asset)).toEqual([
      find('USDC', BSC),
      find('USDT', BASE),
      find('EURC', BASE),
    ]);
    expect(crypto.rows[0].subtitle).toBe('Ether · arrives on Base');
  });

  it('keeps to the backend’s routes once it has them', () => {
    const from = find('ETH', BASE);
    const reachable = new Set([key(find('USDT', BASE)), key(find('EURC', ETHEREUM))]);
    const sections = getAssetSections(all, { from, reachable, chainName });
    expect(titles(sections)).toEqual(['Stablecoins: USDT, EURC']);
    expect(sections[0].rows[1].asset).toBe(find('EURC', ETHEREUM));
  });

  it('offers every Fuse coin from a Fuse coin, which Algebra routes whatever LI.FI says', () => {
    const from = find('USDC', FUSE);
    const reachable = new Set([key(find('USDC', BASE))]);
    expect(titles(getAssetSections(all, { from, reachable, chainName }))).toEqual([
      'Stablecoins: USDT',
      'Earn: USD Yield, FUSE Yield',
      'Crypto: FUSE, WFUSE',
    ]);
  });
});

describe('names and fee copy', () => {
  it('calls a share token by its product', () => {
    expect(assetDisplayName({ symbol: 'soUSD' })).toBe('USD Yield');
    expect(assetDisplayName({ symbol: 'USDCe' })).toBe('USDC');
  });

  it('names a listed coin by the list, whatever this build’s vault calls itself', () => {
    expect(
      assetDisplayName({ symbol: 'fUSDC', chainId: FUSE, address: ADDRESSES.fuse.vault }),
    ).toBe('USD Yield');
  });

  it('explains the plan fee', () => {
    expect(swapFeeFootnote('core')).toBe('Core plan fee. Prime pays 0.25%, Ultra pays nothing.');
    expect(swapFeeFootnote('ultra')).toBe('Ultra pays no swap fee.');
    expect(swapFeeFootnote(undefined)).toBeUndefined();
  });
});
