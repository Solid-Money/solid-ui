import {
  bestLockPaymentBalance,
  chooseLockPayment,
  lockPaymentBalance,
  type LockPaymentBalances,
} from '@/lib/tierLockPayment';

const balances = (over: Partial<LockPaymentBalances> = {}): LockPaymentBalances => ({
  sofuse: 0,
  native: 0,
  wrapped: 0,
  ...over,
});

describe('chooseLockPayment', () => {
  it('spends Savings first, so liquid FUSE is left where the user put it', () => {
    expect(chooseLockPayment(90_000, balances({ sofuse: 100_000, native: 500_000 }), true)).toBe(
      'soFUSE',
    );
  });

  it('falls through to native FUSE when Savings cannot cover it alone', () => {
    expect(chooseLockPayment(90_000, balances({ sofuse: 50_000, native: 100_000 }), true)).toBe(
      'FUSE',
    );
  });

  it('falls through to WFUSE last', () => {
    expect(chooseLockPayment(90_000, balances({ sofuse: 50_000, wrapped: 100_000 }), true)).toBe(
      'WFUSE',
    );
  });

  /**
   * The zap is what makes FUSE and WFUSE payable at all. Without it the only
   * thing that can be locked is what is already in Savings.
   */
  it('offers only Savings when the zap is not deployed', () => {
    expect(
      chooseLockPayment(90_000, balances({ sofuse: 50_000, native: 500_000 }), false),
    ).toBeNull();
    expect(chooseLockPayment(90_000, balances({ sofuse: 90_000, native: 500_000 }), false)).toBe(
      'soFUSE',
    );
  });

  /**
   * The zap takes one deposit. Two balances that only cover the tier together
   * are not an upgrade the user can make in one press.
   */
  it('does not pool two balances that only cover it together', () => {
    expect(
      chooseLockPayment(90_000, balances({ sofuse: 50_000, native: 50_000 }), true),
    ).toBeNull();
  });

  /**
   * Both sides come out of on-chain bigints through a double, so a balance
   * worth exactly the threshold can land a few ulps under it — the same
   * tolerance `canAffordUpgrade` uses, and for the same reason.
   */
  it('treats a balance a hair under the threshold as covering it', () => {
    expect(chooseLockPayment(90_000, balances({ sofuse: 90_000 - 1e-12 }), true)).toBe('soFUSE');
  });

  it('is not fooled by a balance that is genuinely short', () => {
    expect(chooseLockPayment(90_000, balances({ sofuse: 89_999 }), true)).toBeNull();
  });
});

describe('bestLockPaymentBalance', () => {
  /**
   * What the shortfall is measured against. Measuring it against Savings alone
   * told a user holding 80,000 FUSE that they were 90,000 short.
   */
  it('is the largest single balance the lock could be paid from', () => {
    expect(bestLockPaymentBalance(balances({ sofuse: 10, native: 80_000 }), true)).toBe(80_000);
  });

  it('is the Savings balance alone when the zap is not deployed', () => {
    expect(bestLockPaymentBalance(balances({ sofuse: 10, native: 80_000 }), false)).toBe(10);
  });
});

describe('lockPaymentBalance', () => {
  it('reads the balance the chosen asset is denominated by', () => {
    const held = balances({ sofuse: 1, native: 2, wrapped: 3 });

    expect(lockPaymentBalance('soFUSE', held)).toBe(1);
    expect(lockPaymentBalance('FUSE', held)).toBe(2);
    expect(lockPaymentBalance('WFUSE', held)).toBe(3);
  });
});
