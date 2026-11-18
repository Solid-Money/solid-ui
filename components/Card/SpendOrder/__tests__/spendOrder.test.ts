import { moveSlot } from '@/components/Card/OrderList/reorder';
import {
  buildSpendOrderRows,
  DIVIDER,
  fromSlots,
  spendsNothing,
  toSlots,
} from '@/components/Card/SpendOrder/spendOrderRows';
import { CARD_SPENDABLE_ASSETS } from '@/constants/cardSpendableAssets';
import { withoutExcludedAssets } from '@/lib/utils/cardSpendable';
import {
  DEFAULT_SPEND_ORDER,
  normalizeSpendOrder,
  sameSpendOrder,
  type SpendAssetKey,
  spendAssetKeyOf,
} from '@/lib/utils/spendOrder';

import type { SpendableAssetRow } from '@/components/Card/NewCardDetails/SpendMode/useSpendableAssetRows';

describe('normalizeSpendOrder', () => {
  it('fills keys a partial order leaves out at their default place, and drops unknown ones', () => {
    const { order, excluded } = normalizeSpendOrder(['BTC', 'USDC', 'NOPE'], ['ETH', 'NOPE']);

    expect(order[0]).toBe('BTC');
    expect(order).toHaveLength(DEFAULT_SPEND_ORDER.length);
    expect(new Set(order).size).toBe(DEFAULT_SPEND_ORDER.length);
    expect(excluded).toEqual(['ETH']);
  });

  it('reads no order as the default order', () => {
    expect(normalizeSpendOrder(undefined, undefined).order).toEqual(DEFAULT_SPEND_ORDER);
  });

  it('slots BTC Yield and Wrapped Bitcoin in after Bitcoin for an order saved before they existed', () => {
    const before = DEFAULT_SPEND_ORDER.filter(key => key !== 'BTC_YIELD' && key !== 'WBTC');
    const { order } = normalizeSpendOrder(before, []);

    expect(order).toEqual(DEFAULT_SPEND_ORDER);
    expect(order.slice(order.indexOf('BTC'), order.indexOf('BTC') + 4)).toEqual([
      'BTC',
      'BTC_YIELD',
      'WBTC',
      'ETH',
    ]);
  });
});

describe('spendAssetKeyOf', () => {
  it('keys soBTC and WBTC to their own rows, apart from cbBTC', () => {
    expect(spendAssetKeyOf('soBTC')).toBe('BTC_YIELD');
    expect(spendAssetKeyOf('WBTC')).toBe('WBTC');
    expect(spendAssetKeyOf('cbBTC')).toBe('BTC');
    expect(spendAssetKeyOf('DAI')).toBeUndefined();
    expect(spendAssetKeyOf(undefined)).toBeUndefined();
  });
});

describe('spend order slots', () => {
  const visible = new Set<SpendAssetKey>(['USDC', 'USDT', 'USD_YIELD', 'ETH']);
  const preference = { order: [...DEFAULT_SPEND_ORDER], excluded: [] as SpendAssetKey[] };

  it('lists the visible assets in order above the divider', () => {
    expect(toSlots(preference, visible)).toEqual(['USDC', 'USDT', 'USD_YIELD', 'ETH', DIVIDER]);
  });

  it('excludes an asset dragged below the divider and keeps hidden assets in place', () => {
    const next = fromSlots(['USDT', 'USDC', 'USD_YIELD', DIVIDER, 'ETH'], preference, visible);

    expect(next.excluded).toEqual(['ETH']);
    expect(next.order.slice(0, 2)).toEqual(['USDT', 'USDC']);
    // EURC is not shown on this card; it keeps its default rank.
    expect(next.order.indexOf('EURC')).toBe(DEFAULT_SPEND_ORDER.indexOf('EURC'));
    expect(sameSpendOrder(next, preference)).toBe(false);
  });

  it('moves a row across the divider one step at a time', () => {
    const slots = toSlots(preference, visible);
    expect(moveSlot(slots, 'ETH', 1)).toEqual(['USDC', 'USDT', 'USD_YIELD', DIVIDER, 'ETH']);
  });

  it('lists an excluded asset below the divider, in its ranked place', () => {
    const excluded = {
      order: [...DEFAULT_SPEND_ORDER],
      excluded: ['USDT', 'USDC'] as SpendAssetKey[],
    };
    expect(toSlots(excluded, visible)).toEqual(['USD_YIELD', 'ETH', DIVIDER, 'USDC', 'USDT']);
  });

  it('round-trips the order on screen through fromSlots', () => {
    const slots = ['ETH', 'USDC', DIVIDER, 'USD_YIELD', 'USDT'];
    expect(toSlots(fromSlots(slots, preference, visible), visible)).toEqual(slots);
  });

  it('brings an excluded asset back when it is dragged above the divider', () => {
    const excluded = { order: [...DEFAULT_SPEND_ORDER], excluded: ['ETH'] as SpendAssetKey[] };
    const next = fromSlots(['USDC', 'ETH', 'USDT', 'USD_YIELD', DIVIDER], excluded, visible);

    expect(next.excluded).toEqual([]);
    expect(next.order.indexOf('ETH')).toBeLessThan(next.order.indexOf('USDT'));
  });

  it('keeps a hidden asset’s exclusion when the visible ones move', () => {
    const hiddenOut = { order: [...DEFAULT_SPEND_ORDER], excluded: ['ZEC'] as SpendAssetKey[] };
    const next = fromSlots(['USDT', 'USDC', 'USD_YIELD', 'ETH', DIVIDER], hiddenOut, visible);

    expect(next.excluded).toEqual(['ZEC']);
    expect(next.order).toHaveLength(DEFAULT_SPEND_ORDER.length);
  });
});

describe('spendsNothing', () => {
  it('is true only when every listed asset sits below the divider', () => {
    expect(spendsNothing([DIVIDER, 'USDC', 'USDT'])).toBe(true);
    expect(spendsNothing(['USDC', DIVIDER, 'USDT'])).toBe(false);
    expect(spendsNothing(['USDC', 'USDT', DIVIDER])).toBe(false);
    // Nothing listed at all is not "everything excluded".
    expect(spendsNothing([DIVIDER])).toBe(false);
  });
});

describe('buildSpendOrderRows', () => {
  const held = (row: Partial<SpendableAssetRow> & Pick<SpendableAssetRow, 'key'>) =>
    ({
      icon: 'usdc',
      amount: 0,
      name: 'USDC',
      value: '$0.00',
      usd: 0,
      isDollar: false,
      ...row,
    }) as SpendableAssetRow;

  const asset = (symbol: string) => ({
    symbol,
    chainIds: [8453],
    addresses: [symbol.toLowerCase()],
  });

  it('gives soBTC and WBTC their own rows, zero when not held', () => {
    const rows = buildSpendOrderRows([asset('soBTC'), asset('WBTC'), asset('cbBTC')], []);

    expect([...rows.keys()]).toEqual(['BTC_YIELD', 'WBTC', 'BTC']);
    expect(rows.get('BTC_YIELD')).toMatchObject({
      icon: 'sobtc',
      name: 'BTC Yield',
      subtitle: 'Earning until it’s needed',
      value: '$0.00',
    });
    expect(rows.get('WBTC')).toMatchObject({
      icon: 'wbtc',
      name: 'Wrapped Bitcoin',
      subtitle: 'Sold at market price',
    });
  });

  it('takes a single holding’s figures as the Cash panel shows them', () => {
    const rows = buildSpendOrderRows(
      [asset('WBTC')],
      [
        held({
          key: 'WBTC:0',
          spendKey: 'WBTC',
          icon: 'wbtc',
          value: '$310.00',
          detail: '0.0031 WBTC',
        }),
      ],
    );

    expect(rows.get('WBTC')).toMatchObject({ value: '$310.00', detail: '0.0031 WBTC' });
  });

  it('adds up soUSD held on Fuse and on Base into one row', () => {
    const rows = buildSpendOrderRows(
      [asset('soUSD'), asset('soUSD')],
      [
        held({
          key: 'soUSD:0',
          spendKey: 'USD_YIELD',
          name: 'soUSD',
          usd: 10,
          amount: 9,
          detail: '9.00 soUSD',
        }),
        held({
          key: 'soUSD:1',
          spendKey: 'USD_YIELD',
          name: 'soUSD',
          usd: 5,
          amount: 4.5,
          detail: '4.50 soUSD',
        }),
      ],
    );

    expect(rows.size).toBe(1);
    expect(rows.get('USD_YIELD')).toMatchObject({ value: '$15.00', detail: '13.50 soUSD' });
  });

  it('never lists the card bonus, which is not an asset the order ranks', () => {
    const rows = buildSpendOrderRows(
      [asset('USDC')],
      [held({ key: 'card-credit', icon: 'cardCredit', name: 'Card bonus', usd: 0 })],
    );

    expect([...rows.keys()]).toEqual(['USDC']);
    expect([...rows.values()].some(row => row.name === 'Card bonus')).toBe(false);
  });
});

describe('withoutExcludedAssets', () => {
  it('leaves an excluded asset out of the spendable set', () => {
    const symbols = withoutExcludedAssets(CARD_SPENDABLE_ASSETS, ['USD_YIELD']).map(
      asset => asset.symbol,
    );
    expect(symbols).not.toContain('soUSD');
    expect(symbols).toContain('USDC');
  });
});
