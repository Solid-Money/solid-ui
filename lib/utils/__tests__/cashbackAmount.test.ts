import { Cashback, CashbackStatus } from '@/lib/types';
import { getCashbackAmount } from '@/lib/utils/cardHelpers';

const cashback = (overrides: Partial<Cashback>): Cashback =>
  ({
    _id: 'cb-1',
    transactionId: 'tx-1',
    status: CashbackStatus.Escrowed,
    createdAt: '2026-09-02T09:03:23.823Z',
    ...overrides,
  }) as Cashback;

describe('getCashbackAmount', () => {
  it('quotes the projection while the cashback is still escrowed', () => {
    // The case this exists for: a purchase made today. Nothing has been paid,
    // so the figure comes from the backend's projection rather than a payout.
    const info = getCashbackAmount('tx-1', [
      cashback({ projectedUsdValue: 5.766664, payoutAt: '2026-09-16T09:03:23.823Z' }),
    ]);

    expect(info).toEqual({
      amount: '+$5.77',
      isPending: true,
      isEscrowed: true,
      isPaid: false,
      isIneligible: false,
      payoutAt: '2026-09-16T09:03:23.823Z',
    });
  });

  it('leaves the amount unset when the backend sends no projection', () => {
    // An older backend. The surface falls back to naming the status, which is
    // exactly what it did before projections existed.
    const info = getCashbackAmount('tx-1', [cashback({})]);

    expect(info).toMatchObject({ amount: null, isEscrowed: true, isPaid: false });
  });

  it('marks a settled cashback paid, so the figure can turn green', () => {
    const info = getCashbackAmount('tx-1', [
      cashback({ status: CashbackStatus.Paid, soUsdAmount: '5.5', soUsdRate: '1.05' }),
    ]);

    expect(info).toMatchObject({ amount: '+$5.78', isPaid: true, isPending: false });
  });

  it('does not call an escrowed campaign payout paid', () => {
    // A campaign row is written with its payout amount up front, so it has a
    // real figure while still being escrowed — green would claim it had landed.
    const info = getCashbackAmount('tx-1', [cashback({ soUsdAmount: '10', soUsdRate: '1' })]);

    expect(info).toMatchObject({ amount: '+$10.00', isPaid: false, isEscrowed: true });
  });

  it('values a legacy FUSE payout at its recorded price', () => {
    const info = getCashbackAmount('tx-1', [
      cashback({ status: CashbackStatus.Paid, fuseAmount: '200', fuseUsdPrice: '0.0125' }),
    ]);

    expect(info).toMatchObject({ amount: '+$2.50', isPaid: true });
  });

  it('ignores a projection that is zero or nonsensical', () => {
    for (const projectedUsdValue of [0, -1, Number.NaN]) {
      expect(getCashbackAmount('tx-1', [cashback({ projectedUsdValue })])).toMatchObject({
        amount: null,
      });
    }
  });

  it('reports nothing for a transaction with no cashback of its own', () => {
    expect(getCashbackAmount('tx-other', [cashback({})])).toBeNull();
    expect(getCashbackAmount('tx-1', undefined)).toBeNull();
  });

  /**
   * The one status that will never pay and is still shown. A cash withdrawal
   * with no cashback row looks identical to a purchase whose cashback has not
   * arrived yet, so the receipt states the exclusion rather than leaving a gap.
   */
  it('surfaces an ineligible purchase instead of hiding it', () => {
    const info = getCashbackAmount('tx-1', [cashback({ status: CashbackStatus.Ineligible })]);

    expect(info).toEqual({
      amount: null,
      isPending: false,
      isEscrowed: false,
      isPaid: false,
      isIneligible: true,
    });
  });

  it('hides cashback that will never pay', () => {
    for (const status of [
      CashbackStatus.Canceled,
      CashbackStatus.Failed,
      CashbackStatus.PermanentlyFailed,
      CashbackStatus.FullyRefunded,
    ]) {
      expect(getCashbackAmount('tx-1', [cashback({ status })])).toBeNull();
    }
  });
});
