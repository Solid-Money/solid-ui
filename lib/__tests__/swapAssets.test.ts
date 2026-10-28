import { zeroAddress } from 'viem';

import {
  assetDisplayName,
  getAssetSections,
  payAssetSections,
  swapFeeFootnote,
} from '@/lib/swapAssets';
import { SwapAssetWithBalance } from '@/lib/types/lifi-swap';

const NAMES: Record<number, string> = { 122: 'Fuse', 8453: 'Base', 1: 'Ethereum' };
const chainName = (id: number) => NAMES[id] ?? String(id);

let next = 1;
const asset = (
  symbol: string,
  chainId: number,
  balance = 0,
  overrides: Partial<SwapAssetWithBalance> = {},
): SwapAssetWithBalance => ({
  chainId,
  address: `0x${(next++).toString(16).padStart(40, '0')}` as `0x${string}`,
  symbol,
  name: symbol,
  decimals: 6,
  isNative: false,
  balance,
  balanceRaw: BigInt(Math.round(balance * 1e6)),
  balanceUsd: balance,
  priceUsd: 1,
  swappable: true,
  ...overrides,
});

const titles = (sections: { title: string; rows: { name: string }[] }[]) =>
  sections.map(section => `${section.title}: ${section.rows.map(row => row.name).join(', ')}`);

describe('You pay', () => {
  const usdcFuse = asset('USDCe', 122, 30);
  const usdcBase = asset('USDC', 8453, 12.1);
  const usdt = asset('USDT', 122, 5);
  const usdYield = asset('soUSD', 122, 18.43, { balanceUsd: 19.94 });
  const usdYieldBase = asset('soUSD', 8453, 5, { swappable: false, balanceUsd: 5.41 });
  const fuseNative = asset('FUSE', 122, 145, {
    isNative: true,
    address: zeroAddress,
    balanceUsd: 1.2,
  });
  const ethBase = asset('ETH', 8453, 0.0081, {
    isNative: true,
    address: zeroAddress,
    balanceUsd: 31.46,
  });
  const notHeld = asset('EURC', 8453, 0);

  const sections = payAssetSections(
    [usdcFuse, usdcBase, usdt, usdYield, usdYieldBase, fuseNative, ethBase, notHeld],
    { chainName },
  );

  it('groups by asset into the sections the design lists, held coins only', () => {
    expect(titles(sections)).toEqual([
      'Stablecoins: USDC, USDT',
      'Earn: USD Yield',
      'Crypto: ETH, FUSE',
      'Can’t be swapped yet: USD Yield on Base',
    ]);
  });

  it('counts USDC across networks and pays from the one holding most', () => {
    const usdc = sections[0].rows[0];
    expect(usdc.subtitle).toBe('On 2 networks');
    expect(usdc.asset).toBe(usdcFuse);
    expect(usdc.balanceUsd).toBeCloseTo(42.1);
  });

  it('names the network of a coin held only off Fuse', () => {
    expect(sections[2].rows[0].subtitle).toBe('On Base');
  });

  it('greys out a held yield share the backend won’t quote, and says where it goes', () => {
    const [row] = sections[3].rows;
    expect(row.disabled).toBe(true);
    expect(row.subtitle).toBe('Withdraw it in Earn instead');
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
  const from = asset('soUSD', 122, 18.43);
  const usdcFuse = asset('USDCe', 122);
  const usdcBase = asset('USDC', 8453);
  const usdt = asset('USDT', 122);
  const fuseNative = asset('FUSE', 122, 0, { isNative: true, address: zeroAddress });
  const eurc = asset('EURC', 8453);
  const ethYield = asset('soETH', 122);
  const eth = asset('ETH', 1, 0, { isNative: true, address: zeroAddress });
  const unlisted = asset('ZORRA', 8453, 0, { swappable: false });
  const all = [from, usdcFuse, usdcBase, usdt, fuseNative, eurc, ethYield, eth, unlisted];
  const key = (a: SwapAssetWithBalance) => `${a.chainId}:${a.address.toLowerCase()}`;

  it('lists what can be quoted, popular first, never the coin being paid with', () => {
    expect(titles(getAssetSections(all, { from, reachable: null, chainName }))).toEqual([
      'Popular: USDC, USDT, FUSE',
      'Euro: EURC',
      'Earn: ETH Yield',
      'Crypto: ETH',
    ]);
  });

  it('delivers on the paying network when it can, and says where else it arrives', () => {
    const sections = getAssetSections(all, { from, reachable: null, chainName });
    const usdc = sections[0].rows[0];
    expect(usdc.asset).toBe(usdcFuse);
    expect(usdc.subtitle).toBe('Dollar coin · card and Send use it');
    expect(sections[1].rows[0].subtitle).toBe('Euro coin · arrives on Base');
  });

  it('keeps to the backend’s routes once it has them', () => {
    const fromBase = asset('ETH', 8453, 1, { isNative: true, address: zeroAddress });
    const reachable = new Set([key(usdcBase), key(eurc)]);
    const sections = getAssetSections([fromBase, ...all], { from: fromBase, reachable, chainName });
    expect(titles(sections)).toEqual(['Popular: USDC', 'Euro: EURC']);
    expect(sections[0].rows[0].asset).toBe(usdcBase);
  });

  it('offers every Fuse coin from a Fuse coin, which Algebra routes whatever LI.FI says', () => {
    const reachable = new Set([key(eurc)]);
    expect(titles(getAssetSections(all, { from, reachable, chainName }))).toEqual([
      'Popular: USDC, USDT, FUSE',
      'Euro: EURC',
      'Earn: ETH Yield',
    ]);
  });
});

describe('names and fee copy', () => {
  it('calls a share token by its product', () => {
    expect(assetDisplayName({ symbol: 'soUSD' })).toBe('USD Yield');
    expect(assetDisplayName({ symbol: 'USDCe' })).toBe('USDC');
  });

  it('explains the plan fee', () => {
    expect(swapFeeFootnote('core')).toBe('Core plan fee. Prime pays 0.25%, Ultra pays nothing.');
    expect(swapFeeFootnote('ultra')).toBe('Ultra pays no swap fee.');
    expect(swapFeeFootnote(undefined)).toBeUndefined();
  });
});
