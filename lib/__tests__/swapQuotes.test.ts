import { TradeType } from '@cryptoalgebra/fuse-sdk';

import { quotedAmount, QuoterResult, selectBestQuote } from '@/lib/utils/swap/quotes';

/** A quoter answer with the given per-hop amounts; the rest doesn't matter here. */
const quote = (amountsOut: bigint[], amountsIn: bigint[]): QuoterResult => [
  amountsOut,
  amountsIn,
  amountsOut.map(() => 1n),
  amountsOut.map(() => 0),
  0n,
  amountsOut.map(() => 500),
];
const ok = (result: QuoterResult) => ({ result, status: 'success' as const });
const failed = { result: undefined, status: 'failure' as const };

describe('quotedAmount', () => {
  it('reads the last hop’s output on exact-in and the total input on exact-out', () => {
    // Two hops: 100 in → 80 → 60 out.
    const result = quote([80n, 60n], [100n, 80n]);
    expect(quotedAmount(result, TradeType.EXACT_INPUT)).toBe(60n);
    // Exact-out walks the path backwards, so the last entry is what goes in first.
    expect(quotedAmount(quote([60n, 80n], [80n, 100n]), TradeType.EXACT_OUTPUT)).toBe(100n);
  });
});

describe('selectBestQuote', () => {
  it('picks the route with the most output on exact-in', () => {
    const results = [ok(quote([90n], [100n])), ok(quote([95n], [100n])), ok(quote([92n], [100n]))];
    expect(selectBestQuote(results, TradeType.EXACT_INPUT)).toMatchObject({
      index: 1,
      amount: 95n,
    });
  });

  it('picks the route that costs the least input on exact-out', () => {
    // Every route delivers the same 1000 out, so ranking on the output list
    // can't tell them apart. The cheapest input has to win.
    const results = [
      ok(quote([1000n], [50n])),
      ok(quote([1000n], [40n])),
      ok(quote([1000n], [45n])),
    ];
    expect(selectBestQuote(results, TradeType.EXACT_OUTPUT)).toMatchObject({
      index: 1,
      amount: 40n,
    });
  });

  it('skips routes the quoter could not price', () => {
    const results = [failed, ok(quote([90n], [100n])), failed];
    expect(selectBestQuote(results, TradeType.EXACT_INPUT)).toMatchObject({ index: 1 });
    expect(selectBestQuote([failed], TradeType.EXACT_INPUT)).toBeUndefined();
    expect(selectBestQuote(undefined, TradeType.EXACT_OUTPUT)).toBeUndefined();
  });

  it('keeps the earlier route on a tie', () => {
    const results = [ok(quote([90n], [100n])), ok(quote([90n], [100n]))];
    expect(selectBestQuote(results, TradeType.EXACT_INPUT)).toMatchObject({ index: 0 });
    expect(selectBestQuote(results, TradeType.EXACT_OUTPUT)).toMatchObject({ index: 0 });
  });

  it('carries the fee and price lists of the route it picked', () => {
    const best = quote([95n], [100n]);
    const results = [ok(quote([90n], [100n])), ok(best)];
    expect(selectBestQuote(results, TradeType.EXACT_INPUT)).toEqual({
      index: 1,
      amount: 95n,
      fee: best[5],
      priceAfterSwap: best[2],
    });
  });
});
