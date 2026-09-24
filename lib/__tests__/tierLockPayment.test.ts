import {
  availableLockAssets,
  canPayLockWith,
  DEFAULT_LOCK_ASSET,
  lockPaymentBalance,
  resolveLockAsset,
  type LockPaymentBalances,
} from '@/lib/tierLockPayment';

const balances = (over: Partial<LockPaymentBalances> = {}): LockPaymentBalances => ({
  sofuse: 0,
  native: 0,
  wrapped: 0,
  ...over,
});

describe('availableLockAssets', () => {
  it('offers all three once the zap can deposit and lock in one transaction', () => {
    expect(availableLockAssets(true)).toEqual(['FUSE', 'WFUSE', 'soFUSE']);
  });

  /**
   * FUSE and WFUSE are payable only through the zap. Without it the picker has
   * to collapse rather than offer two choices that would revert.
   */
  it('collapses to Savings when the zap is not deployed', () => {
    expect(availableLockAssets(false)).toEqual(['soFUSE']);
  });

  it('opens on native FUSE, which is what a user holding FUSE has', () => {
    expect(DEFAULT_LOCK_ASSET).toBe('FUSE');
    expect(availableLockAssets(true)[0]).toBe(DEFAULT_LOCK_ASSET);
  });
});

describe('resolveLockAsset', () => {
  it('keeps the choice the user made', () => {
    expect(resolveLockAsset('WFUSE', true)).toBe('WFUSE');
    expect(resolveLockAsset('soFUSE', true)).toBe('soFUSE');
  });

  /**
   * A stored choice outlives the thing that made it possible — the zap can be
   * switched off between sessions — and a Safe still remembering "FUSE" would
   * build a transaction against a contract the backend no longer names.
   */
  it('falls back to Savings when the zap is switched off under it', () => {
    expect(resolveLockAsset('FUSE', false)).toBe('soFUSE');
    expect(resolveLockAsset('WFUSE', false)).toBe('soFUSE');
  });
});

describe('canPayLockWith', () => {
  it('reads the balance the chosen asset is denominated by', () => {
    const held = balances({ sofuse: 90_000, native: 0, wrapped: 0 });

    expect(canPayLockWith('soFUSE', 90_000, held)).toBe(true);
    expect(canPayLockWith('FUSE', 90_000, held)).toBe(false);
    expect(canPayLockWith('WFUSE', 90_000, held)).toBe(false);
  });

  /**
   * The zap takes one deposit. Two balances that only cover the tier together
   * are not an upgrade anyone can make in one press.
   */
  it('does not pool two balances that only cover it together', () => {
    const held = balances({ native: 50_000, wrapped: 50_000 });

    expect(canPayLockWith('FUSE', 90_000, held)).toBe(false);
    expect(canPayLockWith('WFUSE', 90_000, held)).toBe(false);
  });

  /**
   * Both sides come out of on-chain bigints through a double, so a balance
   * worth exactly the threshold can land a few ulps under it — the same
   * tolerance `canAffordUpgrade` uses, and for the same reason.
   */
  it('treats a balance a hair under the threshold as covering it', () => {
    expect(canPayLockWith('FUSE', 90_000, balances({ native: 90_000 - 1e-12 }))).toBe(true);
  });

  it('is not fooled by a balance that is genuinely short', () => {
    expect(canPayLockWith('FUSE', 90_000, balances({ native: 89_999 }))).toBe(false);
  });
});

describe('lockPaymentBalance', () => {
  it('maps each asset to the balance it is held as', () => {
    const held = balances({ sofuse: 1, native: 2, wrapped: 3 });

    expect(lockPaymentBalance('soFUSE', held)).toBe(1);
    expect(lockPaymentBalance('FUSE', held)).toBe(2);
    expect(lockPaymentBalance('WFUSE', held)).toBe(3);
  });
});
