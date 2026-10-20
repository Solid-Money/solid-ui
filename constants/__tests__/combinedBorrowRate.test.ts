import { combinedBorrowRate } from '@/constants/cardSpendV2';

describe('combinedBorrowRate', () => {
  const instance = (debtUsd: bigint, borrowApyPerSecond: bigint) => ({
    debtUsd,
    borrowApyPerSecond,
  });

  it('quotes the one rate when both instances charge it', () => {
    expect(combinedBorrowRate([instance(5n, 1_243_680_656n), instance(0n, 1_243_680_656n)])).toBe(
      1_243_680_656n,
    );
  });

  it('weights the rates by the debt drawn on each', () => {
    // $3 at 100 and $1 at 300 → (300 + 300) / 4.
    expect(combinedBorrowRate([instance(3_000_000n, 100n), instance(1_000_000n, 300n)])).toBe(150n);
  });

  it('ignores the rate of an instance with nothing drawn once there is debt elsewhere', () => {
    expect(combinedBorrowRate([instance(2_000_000n, 100n), instance(0n, 900n)])).toBe(100n);
  });

  it('quotes the highest rate when nothing is drawn anywhere', () => {
    expect(combinedBorrowRate([instance(0n, 100n), instance(0n, 300n)])).toBe(300n);
  });

  it('is zero with no instances', () => {
    expect(combinedBorrowRate([])).toBe(0n);
  });
});
