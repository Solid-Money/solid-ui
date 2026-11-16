import { Cashback, CashbackStatus, CashbackType } from '@/lib/types';
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

  /**
   * A subscription row is the Prime/Ultra perk, paid instead of the tier rate on
   * that charge rather than alongside it. The receipt has to say so: 25% on a
   * $200 subscription and 4% on it are wildly different figures, and a row
   * labelled only "Cashback" reads as the tier rate having been applied.
   */
  it('flags a subscription row and names its category', () => {
    const info = getCashbackAmount('tx-1', [
      cashback({
        type: CashbackType.SubscriptionDiscount,
        subscriptionCategory: 'ai',
        projectedUsdValue: 50,
        payoutAt: '2026-09-18T03:34:33.353Z',
      }),
    ]);

    expect(info).toMatchObject({
      amount: '+$50.00',
      isEscrowed: true,
      isSubscriptionDiscount: true,
      subscriptionCategory: 'ai',
    });
  });

  it('carries the subscription flag onto a settled row', () => {
    const info = getCashbackAmount('tx-1', [
      cashback({
        type: CashbackType.SubscriptionDiscount,
        subscriptionCategory: 'music',
        status: CashbackStatus.Paid,
        soUsdAmount: '11',
        soUsdRate: '1',
      }),
    ]);

    expect(info).toMatchObject({
      amount: '+$11.00',
      isPaid: true,
      isSubscriptionDiscount: true,
      subscriptionCategory: 'music',
    });
  });

  it('leaves a regular row unflagged, including one from before the field existed', () => {
    // `toEqual` on purpose: the flag must be absent rather than false, so that
    // every existing consumer of a regular row sees exactly what it always did.
    for (const type of [CashbackType.Cashback, undefined]) {
      expect(getCashbackAmount('tx-1', [cashback({ type, projectedUsdValue: 8 })])).toEqual({
        amount: '+$8.00',
        isPending: true,
        isEscrowed: true,
        isPaid: false,
        isIneligible: false,
        payoutAt: undefined,
      });
    }
  });

  describe('a euro row', () => {
    /**
     * A cardholder whose Wirex main currency is EUR earns, is capped and is
     * paid in euros (soEUR on Base). Their rows read "+€", and the dollar
     * fields — absent on such a row anyway — are never what values it.
     */
    it('quotes the euro projection while the row is escrowed', () => {
      const info = getCashbackAmount('tx-1', [
        cashback({
          currency: 'EUR',
          fiatAmount: '100.00',
          fiatCurrency: 'EUR',
          projectedEurValue: 2.994,
          payoutAt: '2026-09-16T09:03:23.823Z',
        }),
      ]);

      expect(info).toEqual({
        amount: '+€2.99',
        isPending: true,
        isEscrowed: true,
        isPaid: false,
        isIneligible: false,
        payoutAt: '2026-09-16T09:03:23.823Z',
      });
    });

    it('values a paid row at its soEUR shares times their euro rate', () => {
      const info = getCashbackAmount('tx-1', [
        cashback({
          currency: 'EUR',
          status: CashbackStatus.Paid,
          soEurAmount: '2.5',
          soEurRate: '1.02',
          payoutChainId: 8453,
        }),
      ]);

      expect(info).toMatchObject({ amount: '+€2.55', isPaid: true, isPending: false });
    });

    it('ignores the dollar projection on a euro row', () => {
      // Should a backend ever send both, the euro row is still not priced in dollars.
      const info = getCashbackAmount('tx-1', [
        cashback({ currency: 'EUR', projectedUsdValue: 3.3, projectedEurValue: 3 }),
      ]);

      expect(info).toMatchObject({ amount: '+€3.00' });
    });

    it('leaves the amount unset when no euro projection is sent', () => {
      expect(getCashbackAmount('tx-1', [cashback({ currency: 'EUR' })])).toMatchObject({
        amount: null,
        isEscrowed: true,
      });
    });

    it('reports nothing for a paid euro row with no usable payout', () => {
      expect(
        getCashbackAmount('tx-1', [
          cashback({ currency: 'EUR', status: CashbackStatus.Paid, soEurAmount: '0' }),
        ]),
      ).toBeNull();
    });
  });

  it('reads a row that names USD exactly as one that names no currency', () => {
    const row = { status: CashbackStatus.Paid, soUsdAmount: '5.5', soUsdRate: '1.05' };

    expect(getCashbackAmount('tx-1', [cashback({ ...row, currency: 'USD' })])).toEqual(
      getCashbackAmount('tx-1', [cashback(row)]),
    );
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
