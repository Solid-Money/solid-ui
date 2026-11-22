import { buildCollateralOrderRows } from '@/components/Card/CollateralOrder/collateralOrderRows';
import {
  collateralPreviewFootnote,
  formatLockedAmount,
} from '@/components/Card/CollateralOrder/collateralPreview';
import { moveSlot } from '@/components/Card/OrderList/reorder';
import {
  type CollateralAssetKey,
  collateralAssetKeyOf,
  collateralRank,
  DEFAULT_COLLATERAL_ORDER,
  normalizeCollateralOrder,
  sameCollateralOrder,
  sortByCollateralOrder,
  visibleCollateralOrder,
  withVisibleCollateralOrder,
} from '@/lib/utils/collateralOrder';
import { DEFAULT_SPEND_ORDER } from '@/lib/utils/spendOrder';

import type { CreditCollateralAsset, CreditInstancePosition } from '@/hooks/useCardCreditPositions';
import type { Address } from 'viem';

// collateralOrderRows reads the Credit panel's names from useCreditModeFigures, which imports
// the hooks behind it.
jest.mock('@/hooks/useCardCreditPositions', () => ({ useCardCreditPositions: jest.fn() }));
jest.mock('@/hooks/useCardSpendRegistration', () => ({ useCardSpendRegistration: jest.fn() }));
jest.mock('@/hooks/useMainCurrency', () => ({ useCardDisplayCurrency: jest.fn() }));
jest.mock('@/hooks/useCollateralOrder', () => ({ useCollateralOrder: jest.fn() }));

const FUSE_SOUSD = '0x75333830E7014e909535389a6E5b0C02aA62ca27' as Address;
const BASE_SOUSD = '0x3c0c8f95D7f4265B2dc5575eBc37a6945c7a7A31' as Address;
const SOEUR = '0x4f4B212aF8B5020399dde325e1Bc5B33b53DB70B' as Address;
const CBBTC = '0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf' as Address;
const SOBTC = '0x49d88bd2b250d57fc2c14a16a3420fb149078d00' as Address;
const WBTC = '0x0555e30da8f98308edb960aa94c0db47230d2b9c' as Address;
const AAVE = '0x63706e401c06ac8513145b7687A14804d17f814b' as Address;
const LTV_90 = 900_000_000_000_000_000n;

const asset = (overrides: Partial<CreditCollateralAsset>): CreditCollateralAsset => ({
  chainId: 122,
  token: FUSE_SOUSD,
  symbol: 'soUSD',
  amount: 0n,
  valueUsd: 0n,
  priceUsable: true,
  ltvWad: LTV_90,
  escrowed: 0n,
  loose: 0n,
  decimals: 18,
  priceUsd: 1_000_000n,
  priceInBand: true,
  escrowedValueUsd: 0n,
  ltWad: 950_000_000_000_000_000n,
  liquidationBonusBps: 0,
  countsTowardPower: true,
  listedAsCollateral: true,
  repayFeeBps: 0,
  ...overrides,
});

const instance = (
  chainId: number,
  collateral: CreditCollateralAsset[],
): CreditInstancePosition => ({
  chainId,
  moduleAddress: '0x47A5e832E1178726dd13AdD762774A704878AD98',
  debtUsd: 0n,
  healthFactorWad: 2n ** 256n - 1n,
  fullyPriced: true,
  creditLineUsd: 0n,
  creditHeadroomUsd: 0n,
  availableToBorrowUsd: 0n,
  borrowApyPerSecond: 0n,
  collateral,
  unhealthySince: 0,
  forcedDebtUsd: 0n,
  pendingUnlock: null,
  liquidationsPaused: false,
  params: {
    liquidationGracePeriod: 86_400,
    graceFloorHfWad: 950_000_000_000_000_000n,
    closeFactorBps: 5_000,
    minPositionUsd: 25_000_000n,
    collateralWithdrawDelay: 300,
  },
});

describe('collateral order keys', () => {
  it('is the configured Base lock order, a subset of the spend keys', () => {
    expect(DEFAULT_COLLATERAL_ORDER).toEqual([
      'USD_YIELD',
      'EUR_YIELD',
      'BTC',
      'BTC_YIELD',
      'WBTC',
      'ETH',
      'ETH_YIELD',
      'SOL',
      'AAVE',
      'ZEC',
    ]);
    for (const key of DEFAULT_COLLATERAL_ORDER) expect(DEFAULT_SPEND_ORDER).toContain(key);
  });

  it.each([
    ['soUSD', 'USD_YIELD'],
    ['soEUR', 'EUR_YIELD'],
    ['cbBTC', 'BTC'],
    ['soBTC', 'BTC_YIELD'],
    ['WBTC', 'WBTC'],
    ['WETH', 'ETH'],
    ['soETH', 'ETH_YIELD'],
    ['SOL', 'SOL'],
    ['AAVE', 'AAVE'],
    ['cbZEC', 'ZEC'],
  ])('keys %s as %s', (symbol, key) => {
    expect(collateralAssetKeyOf(symbol)).toBe(key);
  });

  it('has no key for a token the card cannot lock', () => {
    expect(collateralAssetKeyOf('USDC')).toBeUndefined();
    expect(collateralAssetKeyOf('EURC')).toBeUndefined();
    expect(collateralAssetKeyOf(undefined)).toBeUndefined();
  });
});

describe('normalizeCollateralOrder', () => {
  it('reads a missing order as the default', () => {
    expect(normalizeCollateralOrder(undefined)).toEqual([...DEFAULT_COLLATERAL_ORDER]);
  });

  it('keeps a full order as sent', () => {
    const order = [...DEFAULT_COLLATERAL_ORDER].reverse();
    expect(normalizeCollateralOrder(order)).toEqual(order);
  });

  it('collapses duplicates and drops keys that are not collateral or not known', () => {
    const order = normalizeCollateralOrder(['BTC', 'BTC', 'USDC', 'NOPE', 'USD_YIELD']);

    expect(order.indexOf('BTC')).toBeLessThan(order.indexOf('USD_YIELD'));
    expect(order).toHaveLength(DEFAULT_COLLATERAL_ORDER.length);
    expect(new Set(order).size).toBe(DEFAULT_COLLATERAL_ORDER.length);
    expect(order).not.toContain('USDC');
  });

  it('puts a key a partial order leaves out at its default place', () => {
    // EUR_YIELD comes before BTC by default, so it lands in front of it.
    const order = normalizeCollateralOrder(['SOL', 'BTC', 'USD_YIELD']);

    expect(order.indexOf('EUR_YIELD')).toBe(order.indexOf('BTC') - 1);
    expect(order.indexOf('SOL')).toBeLessThan(order.indexOf('BTC'));
    expect(order.indexOf('BTC')).toBeLessThan(order.indexOf('USD_YIELD'));
  });
});

describe('sameCollateralOrder', () => {
  it('compares position by position', () => {
    const order = [...DEFAULT_COLLATERAL_ORDER];
    expect(sameCollateralOrder(order, [...DEFAULT_COLLATERAL_ORDER])).toBe(true);
    expect(
      sameCollateralOrder(order, moveSlot(order, 'USD_YIELD', 1) as CollateralAssetKey[]),
    ).toBe(false);
    expect(sameCollateralOrder(order, order.slice(1))).toBe(false);
  });
});

describe('sorting by the collateral order', () => {
  it('ranks a key the order does not name last', () => {
    expect(collateralRank(['BTC', 'USD_YIELD'], 'USD_YIELD')).toBe(1);
    expect(collateralRank(['BTC', 'USD_YIELD'], 'SOL')).toBe(2);
    expect(collateralRank(['BTC', 'USD_YIELD'], undefined)).toBe(2);
  });

  it('sorts by key and keeps the incoming order between items of one key', () => {
    const items = [
      { id: 'fuse-sousd', key: 'USD_YIELD' as const },
      { id: 'btc', key: 'BTC' as const },
      { id: 'unknown', key: undefined },
      { id: 'base-sousd', key: 'USD_YIELD' as const },
    ];

    const sorted = sortByCollateralOrder(items, item => item.key, ['BTC', 'USD_YIELD']);

    expect(sorted.map(item => item.id)).toEqual(['btc', 'fuse-sousd', 'base-sousd', 'unknown']);
  });
});

describe('the listed order', () => {
  const visible = new Set<CollateralAssetKey>(['USD_YIELD', 'BTC', 'SOL']);

  it('lists only the keys the card can lock, in order', () => {
    expect(visibleCollateralOrder([...DEFAULT_COLLATERAL_ORDER], visible)).toEqual([
      'USD_YIELD',
      'BTC',
      'SOL',
    ]);
  });

  it('writes a rearranged list back into the full order, the hidden keys where they were', () => {
    const next = withVisibleCollateralOrder(
      ['SOL', 'USD_YIELD', 'BTC'],
      [...DEFAULT_COLLATERAL_ORDER],
      visible,
    );

    expect(next).toEqual([
      'SOL',
      'EUR_YIELD',
      'USD_YIELD',
      'BTC_YIELD',
      'WBTC',
      'ETH',
      'ETH_YIELD',
      'BTC',
      'AAVE',
      'ZEC',
    ]);
    expect(visibleCollateralOrder(next, visible)).toEqual(['SOL', 'USD_YIELD', 'BTC']);
  });

  it('keeps the order when the list is not a rearrangement of what is listed', () => {
    const order = [...DEFAULT_COLLATERAL_ORDER];
    expect(withVisibleCollateralOrder(['SOL', 'BTC'], order, visible)).toEqual(order);
  });
});

describe('buildCollateralOrderRows', () => {
  it('lists USD Yield alone for a Fuse-only card', () => {
    const rows = buildCollateralOrderRows({
      fuse: instance(122, [asset({ amount: 1n, valueUsd: 230_000_000n })]),
      base: null,
    });

    expect([...rows.values()]).toEqual([
      {
        key: 'USD_YIELD',
        icon: 'usd',
        name: 'USD Yield',
        subtitle: 'LTV 90%',
        value: '$230.00',
        detail: undefined,
      },
    ]);
  });

  it('lists every collateral the card can lock, $0 ones included', () => {
    const rows = buildCollateralOrderRows({
      fuse: null,
      base: instance(8453, [
        asset({ chainId: 8453, token: BASE_SOUSD }),
        asset({ chainId: 8453, token: CBBTC, symbol: 'cbBTC', ltvWad: 700_000_000_000_000_000n }),
        asset({ chainId: 8453, token: SOBTC, symbol: 'soBTC' }),
        asset({ chainId: 8453, token: WBTC, symbol: 'WBTC', amount: 5n, valueUsd: 4_000_000n }),
        asset({ chainId: 8453, token: AAVE, symbol: 'AAVE', ltvWad: 0n }),
      ]),
    });

    expect([...rows.keys()].sort()).toEqual(['AAVE', 'BTC', 'BTC_YIELD', 'USD_YIELD', 'WBTC']);
    expect(rows.get('BTC')).toMatchObject({
      name: 'Bitcoin',
      icon: 'cbbtc',
      value: '$0.00',
      subtitle: 'LTV 70%',
    });
    expect(rows.get('BTC_YIELD')).toMatchObject({ name: 'BTC Yield', icon: 'sobtc' });
    expect(rows.get('WBTC')).toMatchObject({
      name: 'Wrapped Bitcoin',
      icon: 'wbtc',
      value: '$4.00',
    });
    // A module that sets no LTV gets no line.
    expect(rows.get('AAVE')?.subtitle).toBeUndefined();
  });

  it('leaves out a token taken off the collateral list, even while some is still locked', () => {
    const rows = buildCollateralOrderRows({
      fuse: null,
      base: instance(8453, [
        asset({ chainId: 8453, token: BASE_SOUSD }),
        asset({
          chainId: 8453,
          token: CBBTC,
          symbol: 'cbBTC',
          amount: 5n,
          escrowed: 5n,
          valueUsd: 4_000_000n,
          listedAsCollateral: false,
        }),
      ]),
    });

    expect([...rows.keys()]).toEqual(['USD_YIELD']);
  });

  it('adds soUSD on Fuse and on Base into one row', () => {
    const rows = buildCollateralOrderRows({
      fuse: instance(122, [asset({ amount: 1n, valueUsd: 100_000_000n })]),
      base: instance(8453, [
        asset({ chainId: 8453, token: BASE_SOUSD, amount: 1n, valueUsd: 25_500_000n }),
      ]),
    });

    expect(rows.size).toBe(1);
    expect(rows.get('USD_YIELD')).toMatchObject({ value: '$125.50', subtitle: 'LTV 90%' });
  });

  it('shows the range when Fuse and Base set one key’s LTV apart', () => {
    const rows = buildCollateralOrderRows({
      fuse: instance(122, [asset({ ltvWad: 850_000_000_000_000_000n })]),
      base: instance(8453, [asset({ chainId: 8453, token: BASE_SOUSD })]),
    });

    expect(rows.get('USD_YIELD')?.subtitle).toBe('LTV 85–90%');
  });

  it('reads EUR Yield in euros with its dollar value under it', () => {
    const rows = buildCollateralOrderRows({
      fuse: null,
      base: instance(8453, [
        asset({
          chainId: 8453,
          token: SOEUR,
          symbol: 'soEUR',
          valueUsd: 81_600_000n,
          valueEur: 70_000_000n,
        }),
      ]),
    });

    expect(rows.get('EUR_YIELD')).toMatchObject({
      icon: 'eur',
      value: '€70.00',
      detail: '≈ $81.60',
    });
  });

  it('lists nothing before the credit reads answer, and skips tokens with no key', () => {
    expect(buildCollateralOrderRows(undefined).size).toBe(0);
    const rows = buildCollateralOrderRows({
      fuse: instance(122, [asset({ symbol: 'USDC' })]),
      base: null,
    });
    expect(rows.size).toBe(0);
  });
});

describe('the collateral preview', () => {
  const line = (asset: string, lockedUsd: string) => ({
    asset,
    symbol: asset,
    locked_usd: lockedUsd,
    locked_amount: '1',
  });

  it('says when credit can’t cover the purchase', () => {
    expect(
      collateralPreviewFootnote({
        covered: false,
        amount_usd: '150',
        lines: [line('USD_YIELD', '10')],
      }),
    ).toBe('Your credit can’t cover this purchase.');
  });

  it('says it keeps earning only when every lock is a yield share', () => {
    expect(
      collateralPreviewFootnote({
        covered: true,
        amount_usd: '150',
        lines: [line('USD_YIELD', '100'), line('BTC_YIELD', '50')],
      }),
    ).toBe('Locked, not sold. It keeps earning and unlocks as you repay.');
    expect(
      collateralPreviewFootnote({
        covered: true,
        amount_usd: '150',
        lines: [line('USD_YIELD', '100'), line('BTC', '50')],
      }),
    ).toBe('Locked, not sold. It unlocks as you repay.');
  });

  it('says so when collateral already locked covers it', () => {
    expect(collateralPreviewFootnote({ covered: true, amount_usd: '150', lines: [] })).toBe(
      'Collateral that’s already locked covers this purchase.',
    );
  });

  it('credits the card bonus, not escrow, when the bonus pays', () => {
    expect(
      collateralPreviewFootnote({
        covered: true,
        amount_usd: '150',
        card_credit_usd: '150',
        lines: [],
      }),
    ).toBe('Your card bonus covers this purchase.');
    expect(
      collateralPreviewFootnote({
        covered: true,
        amount_usd: '150',
        card_credit_usd: '30',
        lines: [],
      }),
    ).toBe('Your card bonus and collateral that’s already locked cover this purchase.');
    expect(
      collateralPreviewFootnote({
        covered: true,
        amount_usd: '150',
        card_credit_usd: '30',
        lines: [line('BTC', '120')],
      }),
    ).toBe('Your card bonus pays $30.00 first. Locked, not sold. It unlocks as you repay.');
  });

  it('formats token amounts without rounding a small lock to zero', () => {
    expect(formatLockedAmount('0.00123456')).toBe('0.001235');
    expect(formatLockedAmount('1234.56789')).toBe('1,234.5679');
    expect(formatLockedAmount('0')).toBe('0');
    expect(formatLockedAmount('n/a')).toBe('n/a');
  });

  it('rounds on the decimal string, half up, carrying into the whole part', () => {
    expect(formatLockedAmount('0.99999')).toBe('1');
    expect(formatLockedAmount('1.00005')).toBe('1.0001');
    expect(formatLockedAmount('1.00004')).toBe('1');
    expect(formatLockedAmount('999.99995')).toBe('1,000');
    expect(formatLockedAmount('0.000000000000000001')).toBe('0.000000000000000001');
    expect(formatLockedAmount('2.50')).toBe('2.5');
    expect(formatLockedAmount('.5')).toBe('0.5');
    expect(formatLockedAmount('0.000')).toBe('0');
  });

  it('keeps every digit of an amount past float precision', () => {
    // 2^53 + 1: a float would read it as ...992.
    expect(formatLockedAmount('9007199254740993')).toBe('9,007,199,254,740,993');
    expect(formatLockedAmount('123456789012345678.123456789012345678')).toBe(
      '123,456,789,012,345,678.1235',
    );
  });

  it('leaves anything but a plain decimal as sent', () => {
    expect(formatLockedAmount('')).toBe('');
    expect(formatLockedAmount('1e-7')).toBe('1e-7');
    expect(formatLockedAmount('1.2.3')).toBe('1.2.3');
  });
});
