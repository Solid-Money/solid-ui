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
const POLYGON = 137;

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
      'Earn: USD Yield, USD Yield on Base, ETH Yield on Fuse',
      'Crypto: ETH, FUSE, WFUSE',
      'Can’t be swapped yet: USDC on Arbitrum, Fuse Bridged USDC (Deprecated), FUSE on Base',
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

  it('shows every earn held, greying the ones withdrawn in Earn rather than swapped', () => {
    const [swappable, ...withdrawn] = sections[1].rows;
    expect(swappable.disabled).toBe(false);
    expect(withdrawn.map(row => row.asset)).toEqual([usdYieldBase, ethYield]);
    for (const row of withdrawn) {
      expect(row.disabled).toBe(true);
      expect(row.subtitle).toBe('Withdraw it in Earn instead');
    }
  });

  it('greys out what the list leaves out', () => {
    expect(sections[3].rows.every(row => row.disabled)).toBe(true);
    expect(sections[3].rows[0].subtitle).toBe('Not on the swap list yet');
  });

  it('lists the rest of the swap list and Earn too, greyed, after what is held', () => {
    const sections = payAssetSections(
      [
        asset('USDT', FUSE, 0),
        usdcFuse,
        asset('soFUSE', FUSE, 0),
        asset('soEURC', BASE, 0, { swappable: false }),
        usdYield,
      ],
      { chainName },
    );
    expect(titles(sections)).toEqual([
      'Stablecoins: USDC, USDT',
      'Earn: USD Yield, FUSE Yield, EUR Yield',
    ]);
    const [usdc, usdt] = sections[0].rows;
    expect(usdc.disabled).toBe(false);
    expect(usdt).toMatchObject({ disabled: true, subtitle: 'You don’t have any' });
    expect(sections[1].rows[1]).toMatchObject({ disabled: true, subtitle: 'You don’t have any' });
    expect(sections[1].rows[2]).toMatchObject({
      disabled: true,
      subtitle: 'Deposit and withdraw it in Earn',
    });
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
  /** What can be picked: the rows that aren't greyed. */
  const offered = (...args: Parameters<typeof getAssetSections>) =>
    getAssetSections(...args)
      .map(section => ({ ...section, rows: section.rows.filter(row => !row.disabled) }))
      .filter(section => section.rows.length > 0);

  it('lists the whole swap list and Earn, greying what the paying coin can’t become', () => {
    const from = find('USDC', FUSE);
    const sections = getAssetSections(all, { from, reachable: null, chainName });
    expect(titles(sections)).toEqual([
      'Stablecoins: USDC, USDT, EURC',
      'Earn: USD Yield, FUSE Yield, ETH Yield',
      'Crypto: FUSE, WFUSE, ETH, WETH, cbBTC, WBTC, AAVE, ENA, SOL, UNI',
    ]);
    const row = (name: string) =>
      sections.flatMap(section => section.rows).find(candidate => candidate.name === name)!;
    expect(row('EURC')).toMatchObject({
      disabled: false,
      subtitle: 'Euro coin · arrives on Base',
    });
    expect(row('ETH')).toMatchObject({ disabled: false, subtitle: 'Ether · arrives on Base' });
    expect(row('ETH Yield')).toMatchObject({
      disabled: true,
      subtitle: 'Deposit it in Earn instead',
    });
    expect(row('FUSE').disabled).toBe(false);
  });

  it('greys the coin being paid with when it is on no other network', () => {
    const from = find('FUSE', FUSE);
    const fuseRow = getAssetSections(all, { from, reachable: null, chainName })
      .flatMap(section => section.rows)
      .find(row => row.name === 'FUSE');
    expect(fuseRow).toMatchObject({ disabled: true, subtitle: 'You’re paying with this' });
  });

  it('offers Base, Ethereum and BNB Chain coins for a Fuse coin, the Fuse one first', () => {
    const from = find('soUSD', FUSE);
    const sections = offered(all, { from, reachable: null, chainName });
    expect(titles(sections)).toEqual([
      'Stablecoins: USDC, USDT, EURC',
      'Earn: FUSE Yield',
      'Crypto: FUSE, WFUSE, ETH, WETH, cbBTC, WBTC, AAVE, ENA, SOL, UNI',
    ]);
    const [usdc, , eurc] = sections[0].rows;
    expect(usdc.members).toEqual([
      find('USDC', FUSE),
      find('USDC', BASE),
      find('USDC', ETHEREUM),
      find('USDC', BSC),
    ]);
    expect(eurc).toMatchObject({
      asset: find('EURC', BASE),
      subtitle: 'Euro coin · arrives on Base',
    });
  });

  it('offers WFUSE and the other networks’ coins for FUSE', () => {
    const from = find('FUSE', FUSE);
    const crypto = offered(all, { from, reachable: null, chainName }).find(
      section => section.key === 'crypto',
    );
    expect(crypto?.rows.map(row => row.name)).toEqual([
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
    const sections = offered(all, { from, reachable: null, chainName });
    expect(titles(sections)).toEqual([
      'Stablecoins: USDC, USDT, EURC',
      'Earn: USD Yield, FUSE Yield',
      'Crypto: FUSE, WFUSE, ETH, WETH, cbBTC, WBTC, AAVE, ENA, SOL, UNI',
    ]);
    const [usdc, usdt, eurc] = sections[0].rows;
    expect(usdc.members).toEqual([find('USDC', FUSE), find('USDC', ETHEREUM), find('USDC', BSC)]);
    expect(usdc.subtitle).toBe('Dollar coin · card and Send use it · arrives on Fuse');
    expect(usdt.asset).toBe(find('USDT', BASE));
    expect(usdt.subtitle).toBe('Dollar coin');
    expect(usdt.members).toContain(find('USDT', FUSE));
    expect(eurc.asset).toBe(find('EURC', BASE));
    expect(sections[1].rows[0].subtitle).toBe('Earn on USD · arrives on Fuse');
    expect(sections[2].rows[0].subtitle).toBe('Fuse token · arrives on Fuse');
  });

  it('delivers on the paying network when it can, then Fuse, then Base before Ethereum', () => {
    const from = find('USDT', BSC);
    const sections = offered(all, { from, reachable: null, chainName });
    const inSection = (sectionKey: string) =>
      sections.find(section => section.key === sectionKey)!.rows;
    expect(inSection('stablecoins').map(row => row.asset)).toEqual([
      find('USDC', BSC),
      find('USDT', FUSE),
      find('EURC', BASE),
    ]);
    expect(inSection('crypto').find(row => row.name === 'ETH')?.subtitle).toBe(
      'Ether · arrives on Base',
    );
  });

  it('keeps to the backend’s routes off Fuse once it has them, and offers Fuse whatever they say', () => {
    const from = find('ETH', BASE);
    const reachable = new Set([key(find('USDT', BASE)), key(find('EURC', ETHEREUM))]);
    const sections = getAssetSections(all, { from, reachable, chainName });
    const rows = sections.flatMap(section => section.rows);
    expect(titles(offered(all, { from, reachable, chainName }))).toEqual([
      'Stablecoins: USDC, USDT, EURC',
      'Earn: USD Yield, FUSE Yield',
      'Crypto: FUSE, WFUSE',
    ]);
    const row = (name: string) => rows.find(candidate => candidate.name === name)!;
    // LI.FI's map has no route to USDC off Fuse, so it arrives on Fuse.
    expect(row('USDC').members).toEqual([find('USDC', FUSE)]);
    expect(row('USDT').asset).toBe(find('USDT', BASE));
    expect(row('EURC').asset).toBe(find('EURC', ETHEREUM));
    expect(row('WETH')).toMatchObject({ disabled: true, subtitle: 'Not with ETH on Base yet' });
  });

  it('offers every coin from a Fuse coin, whatever LI.FI’s route map says', () => {
    const from = find('USDC', FUSE);
    const reachable = new Set<string>();
    const sections = offered(all, { from, reachable, chainName });
    expect(titles(sections)).toEqual([
      'Stablecoins: USDC, USDT, EURC',
      'Earn: USD Yield, FUSE Yield',
      'Crypto: FUSE, WFUSE, ETH, WETH, cbBTC, WBTC, AAVE, ENA, SOL, UNI',
    ]);
    expect(sections[0].rows[0].members).toEqual([
      find('USDC', BASE),
      find('USDC', ETHEREUM),
      find('USDC', BSC),
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
