import { CurrencyAmount, Token } from '@cryptoalgebra/fuse-sdk';

import { buildTokenUsdPrice } from '@/lib/utils/tokenUsdPrice';

const FUSE_CHAIN = 122;

// Built here rather than imported from `constants/tokens`: that module reaches
// the asset registry and pulls reanimated into a test with no native runtime.
// The 6 decimals are what matter, and they match STABLECOINS_TOKENS.USDT_V2.
const USDT = new Token(
  FUSE_CHAIN,
  '0x3695Dd1D1D43B794C0B13eb8be8419Eb3ac22bf7',
  6,
  'USDT',
  'USDT',
);

const token = (decimals: number) =>
  new Token(FUSE_CHAIN, '0x1111111111111111111111111111111111111111', decimals, 'TKN', 'Token');

/** The USD value `price.quote()` puts on `amount` whole tokens. */
const usdOf = (decimals: number, usdPerToken: number, whole: string) => {
  const currency = token(decimals);
  const price = buildTokenUsdPrice(currency, usdPerToken, USDT);
  if (!price) return undefined;

  const raw = BigInt(Math.round(Number(whole) * 10 ** decimals));
  return Number(price.quote(CurrencyAmount.fromRawAmount(currency, raw.toString())).toSignificant(12));
};

describe('buildTokenUsdPrice', () => {
  /**
   * The bug this exists to prevent. `Price` multiplies RAW amounts, so building
   * it from a CurrencyAmount's numerator/denominator inflated every quote by
   * 10^(2 * decimals - 6) — 1e30 on an 18-decimal token. A real swap fee of
   * about a cent reached the revenue dashboard as $1.2e28.
   */
  it('prices an 18-decimal token without inflating by its decimals', () => {
    expect(usdOf(18, 2.49, '0.01')).toBeCloseTo(0.0249, 10);
  });

  it('prices a 6-decimal stablecoin at parity', () => {
    expect(usdOf(6, 1, '1')).toBeCloseTo(1, 10);
  });

  it.each([
    [18, 0.0213, '150', 3.195],
    [8, 64000, '0.0005', 32],
    [6, 1.0001, '250', 250.025],
  ])('values %i-decimal tokens at $%s x %s', (decimals, usdPerToken, whole, expected) => {
    expect(usdOf(decimals, usdPerToken, whole)).toBeCloseTo(expected, 6);
  });

  /** Scales linearly — a fee ten times larger is worth ten times as much. */
  it('scales linearly with the amount', () => {
    const one = usdOf(18, 3.5, '1')!;
    const ten = usdOf(18, 3.5, '10')!;
    expect(ten / one).toBeCloseTo(10, 10);
  });

  it('keeps a micro-cap price usable rather than rounding it to nothing', () => {
    // A millionth of a cent per token, a million tokens: one cent.
    expect(usdOf(18, 1e-8, '1000000')).toBeCloseTo(0.01, 10);
  });

  describe('prices it refuses to build', () => {
    /** Recording no USD beats recording a wrong one — the token amount is on chain either way. */
    it.each([
      ['zero', 0],
      ['negative', -1],
      ['NaN', NaN],
      ['Infinity', Infinity],
    ])('returns undefined for a %s price', (_label, usdPerToken) => {
      expect(buildTokenUsdPrice(token(18), usdPerToken, USDT)).toBeUndefined();
    });

    it('returns undefined for a price below the precision it can represent', () => {
      expect(buildTokenUsdPrice(token(18), 1e-15, USDT)).toBeUndefined();
    });
  });
});
