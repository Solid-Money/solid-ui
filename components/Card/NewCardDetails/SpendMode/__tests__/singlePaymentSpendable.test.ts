import {
  instanceSpendable,
  singlePaymentSpendable,
} from '@/components/Card/NewCardDetails/SpendMode/singlePaymentSpendable';

const usd = (dollars: number) => BigInt(dollars * 1_000_000);

describe('instanceSpendable', () => {
  const side = { cashMicroUsd: usd(40), creditMicroUsd: usd(70) };

  test('counts cash in Cash, the credit line in Credit and the larger in Smart', () => {
    expect(instanceSpendable({ ...side, mode: 'cash' })).toBe(usd(40));
    expect(instanceSpendable({ ...side, mode: 'credit' })).toBe(usd(70));
    expect(instanceSpendable({ ...side, mode: 'smart' })).toBe(usd(70));
    expect(instanceSpendable({ mode: 'smart', cashMicroUsd: usd(90), creditMicroUsd: 0n })).toBe(
      usd(90),
    );
  });
});

describe('singlePaymentSpendable', () => {
  test('shows the bigger credit line in Credit, not the total', () => {
    expect(
      singlePaymentSpendable([
        { mode: 'credit', cashMicroUsd: usd(500), creditMicroUsd: usd(30) },
        { mode: 'credit', cashMicroUsd: usd(500), creditMicroUsd: usd(12) },
      ]),
    ).toBe(usd(30));
  });

  test('shows the bigger side in Cash, not the total', () => {
    expect(
      singlePaymentSpendable([
        { mode: 'cash', cashMicroUsd: usd(26), creditMicroUsd: usd(100) },
        { mode: 'cash', cashMicroUsd: usd(10), creditMicroUsd: usd(100) },
      ]),
    ).toBe(usd(26));
  });

  test('counts a side left on Cash by its cash, not a credit line it will not lend', () => {
    const fuse = { mode: 'credit', cashMicroUsd: usd(200), creditMicroUsd: usd(15) } as const;
    expect(
      singlePaymentSpendable([
        fuse,
        { mode: 'cash', cashMicroUsd: usd(8), creditMicroUsd: usd(60) },
      ]),
    ).toBe(usd(15));
    expect(
      singlePaymentSpendable([
        fuse,
        { mode: 'cash', cashMicroUsd: usd(40), creditMicroUsd: usd(60) },
      ]),
    ).toBe(usd(40));
  });

  test('is zero with nothing to spend', () => {
    expect(singlePaymentSpendable([])).toBe(0n);
    expect(
      singlePaymentSpendable([{ mode: 'credit', cashMicroUsd: usd(5), creditMicroUsd: 0n }]),
    ).toBe(0n);
  });
});
