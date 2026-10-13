import { LifiSwapFee, LifiSwapQuote } from '@/lib/types/lifi-swap';
import { formatEta, lifiPriceImpact, lifiTotalCostUsd } from '@/lib/utils/swap/lifi';

const USDC = { address: '0xusdc', chainId: 8453, symbol: 'USDC', decimals: 6, name: 'USD Coin' };
const ETH = { address: '0x0', chainId: 8453, symbol: 'ETH', decimals: 18, name: 'Ether' };

const fee = (overrides: Partial<LifiSwapFee>): LifiSwapFee => ({
  kind: 'provider',
  name: 'LP fee',
  token: USDC,
  amount: '0',
  amountUsd: '0',
  included: true,
  ...overrides,
});

const quote = (overrides: Partial<LifiSwapQuote>): LifiSwapQuote =>
  ({
    fromAmountUsd: '100',
    toAmountUsd: '99',
    fees: [],
    ...overrides,
  }) as LifiSwapQuote;

describe('lifiPriceImpact', () => {
  /**
   * The Solid and LI.FI fees have their own lines in the breakdown. Counting
   * them as price impact too would warn, or block, on a swap whose only cost is
   * the fee the user was shown.
   */
  it('leaves Solid and LI.FI fees out of the impact', () => {
    const impact = lifiPriceImpact(
      quote({
        fromAmountUsd: '100',
        toAmountUsd: '99',
        fees: [fee({ kind: 'solid', amountUsd: '0.5' }), fee({ kind: 'lifi', amountUsd: '0.25' })],
      }),
    );
    // 1.00 lost, 0.75 of it is fees: 0.25%.
    expect(impact?.toFixed(2)).toBe('0.25');
  });

  it('counts bridge and DEX fees as impact', () => {
    const impact = lifiPriceImpact(
      quote({ toAmountUsd: '98', fees: [fee({ kind: 'provider', amountUsd: '2' })] }),
    );
    expect(impact?.toFixed(2)).toBe('2.00');
  });

  it('has no figure when LI.FI could not price a side', () => {
    expect(lifiPriceImpact(quote({ toAmountUsd: null }))).toBeUndefined();
    expect(lifiPriceImpact(undefined)).toBeUndefined();
  });

  it('never reports a negative impact', () => {
    expect(lifiPriceImpact(quote({ toAmountUsd: '101' }))?.toFixed(2)).toBe('0.00');
  });
});

describe('lifiTotalCostUsd', () => {
  /** A fee paid on top in gas token never shows in the in/out difference. */
  it('adds fees paid on top to the in/out difference', () => {
    const total = lifiTotalCostUsd(
      quote({
        fromAmountUsd: '100',
        toAmountUsd: '99',
        fees: [fee({ token: ETH, amountUsd: '0.30', included: false })],
      }),
    );
    expect(total).toBeCloseTo(1.3);
  });
});

describe('formatEta', () => {
  it.each([
    [20, '~20 sec'],
    [90, '~2 min'],
    [7200, '~2 h'],
  ])('formats %d seconds as %s', (seconds, expected) => {
    expect(formatEta(seconds)).toBe(expected);
  });
});
