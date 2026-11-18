import { borrowRisk } from '@/constants/cardSpendV2';

const WAD = 10n ** 18n;
const hf = (value: number) => BigInt(Math.round(value * 10_000)) * (WAD / 10_000n);
const DEBT = 140_000_000n;

/**
 * The liquidation warning. A fresh credit loan rests at `threshold / (ltv × targetLtv)` —
 * about 1.11 on soUSD and soEUR, 1.23 on cbBTC — so nothing at or near those may warn.
 */
describe('borrowRisk', () => {
  it.each([
    ['soUSD or soEUR at rest', 1.111],
    ['cbBTC at rest', 1.228],
    ['a loan that has drifted a little', 1.06],
  ])('stays quiet for %s', (_label, value) => {
    expect(borrowRisk(hf(value), DEBT)).toBe('none');
  });

  it('warns "Getting close" within about 5% of liquidation', () => {
    expect(borrowRisk(hf(1.049), DEBT)).toBe('caution');
    expect(borrowRisk(hf(1.02), DEBT)).toBe('caution');
  });

  it('warns "At risk" within about 2% of liquidation, and below it', () => {
    expect(borrowRisk(hf(1.019), DEBT)).toBe('at-risk');
    expect(borrowRisk(hf(0.97), DEBT)).toBe('at-risk');
  });

  it('never warns with nothing borrowed', () => {
    expect(borrowRisk(hf(0.5), 0n)).toBe('none');
    expect(borrowRisk(2n ** 256n - 1n, DEBT)).toBe('none');
  });
});
