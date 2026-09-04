import { getSwapFundingError } from '@/lib/swapFunding';

const check = (balance?: bigint, requiredInput?: bigint, hasAmount = true) =>
  getSwapFundingError({ balance, requiredInput, hasAmount, symbol: 'USDC' });

it('identifies a confirmed zero balance even before a price is available', () => {
  expect(check(0n)).toBe('Not enough USDC on Fuse. Add funds to continue.');
});

it('does not treat an unavailable balance as zero', () => {
  expect(check(undefined, 10n)).toBeUndefined();
});

it('does not assume a positive balance is insufficient without a price', () => {
  expect(check(1n)).toBeUndefined();
});

it('compares the balance to the selected quote without rounding', () => {
  expect(check(9_999_999n, 10_000_000n)).toContain('Not enough USDC');
  expect(check(10_000_000n, 10_000_000n)).toBeUndefined();
  expect(check(10_000_001n, 10_000_000n)).toBeUndefined();
});

it('waits for an amount before showing the balance warning', () => {
  expect(check(0n, undefined, false)).toBeUndefined();
});
