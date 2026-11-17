import {
  cashbackFiguresByCurrency,
  isMonthlyCashbackCapReached,
  monthlyCashbackCap,
  monthlyCashbackHeadroom,
  monthlyCashbackTotal,
  resolveCashbackMonth,
  resolveCashbackProgress,
  resolveLifetimeCashback,
} from '@/lib/cashbackProgress';

import type { CashbackData, RewardsUserData } from '@/lib/types';

describe('monthlyCashbackTotal', () => {
  it('counts settled and escrowed cashback as one figure', () => {
    expect(monthlyCashbackTotal(30, 15)).toBe(45);
  });

  it('reports the escrowed part alone before anything has settled', () => {
    // The case this exists for: a purchase made today, nothing paid yet.
    expect(monthlyCashbackTotal(0, 7.32)).toBeCloseTo(7.32);
  });

  it('leaves the settled figure alone when the backend sends no projection', () => {
    expect(monthlyCashbackTotal(30, undefined)).toBe(30);
  });

  it('treats missing and nonsensical amounts as nothing', () => {
    expect(monthlyCashbackTotal(undefined, undefined)).toBe(0);
    expect(monthlyCashbackTotal(Number.NaN, -5)).toBe(0);
    expect(monthlyCashbackTotal(-20, 10)).toBe(10);
  });
});

describe('resolveCashbackProgress', () => {
  it('fills the share of the cap the figure has reached', () => {
    expect(resolveCashbackProgress(45, 150)).toBe(30);
  });

  it('never overflows the track', () => {
    expect(resolveCashbackProgress(200, 150)).toBe(100);
  });

  it('fills nothing when no cap is configured', () => {
    // A full bar would claim the user had maxed out a cap that does not exist.
    expect(resolveCashbackProgress(10, 0)).toBe(0);
  });

  it('treats missing and nonsensical amounts as nothing earned', () => {
    expect(resolveCashbackProgress(Number.NaN, 150)).toBe(0);
    expect(resolveCashbackProgress(-20, 150)).toBe(0);
  });
});

describe('monthlyCashbackCap', () => {
  it("reads the cap this month's purchases are paid up to", () => {
    // A Prime trial that ended mid-month: Core now, Prime's cap on what was
    // bought during the trial.
    expect(monthlyCashbackCap({ maxCashbackMonthly: 50, cashbackCapThisMonth: 100 })).toBe(100);
  });

  it("falls back to the tier's cap on an older backend", () => {
    expect(monthlyCashbackCap({ maxCashbackMonthly: 50 })).toBe(50);
  });

  it('reads nothing before the rewards data lands', () => {
    expect(monthlyCashbackCap(undefined)).toBe(0);
  });
});

describe('monthlyCashbackHeadroom', () => {
  it('quotes what a new purchase can still earn, not cap minus earned', () => {
    // $92 of trial purchases against a $100 month: a purchase made now is a
    // Core purchase, and Core's $50 is already used.
    expect(
      monthlyCashbackHeadroom(
        { maxCashbackMonthly: 50, cashbackCapThisMonth: 100, cashbackHeadroomThisMonth: 0 },
        92,
      ),
    ).toBe(0);
  });

  it('works out cap minus earned on an older backend', () => {
    expect(monthlyCashbackHeadroom({ maxCashbackMonthly: 50 }, 20)).toBe(30);
    expect(monthlyCashbackHeadroom({ maxCashbackMonthly: 50 }, 80)).toBe(0);
  });

  it("measures against the tier's cap, not the month's, when no headroom is sent", () => {
    // The trial's $100 is not open to a purchase made now; Core's $50 is.
    expect(monthlyCashbackHeadroom({ maxCashbackMonthly: 50, cashbackCapThisMonth: 100 }, 92)).toBe(
      0,
    );
  });
});

describe('isMonthlyCashbackCapReached', () => {
  it('is reached when a new purchase can earn nothing, even under a higher month cap', () => {
    // "$92 / $100" with nothing left: the hint must not ask for "$0 more".
    expect(isMonthlyCashbackCapReached(0)).toBe(true);
  });

  it('treats float dust and sub-cent headroom as none', () => {
    expect(isMonthlyCashbackCapReached(7e-15)).toBe(true);
    expect(isMonthlyCashbackCapReached(0.004)).toBe(true);
  });

  it('is not reached while a purchase can still add a cent or more', () => {
    expect(isMonthlyCashbackCapReached(0.01)).toBe(false);
    expect(isMonthlyCashbackCapReached(8)).toBe(false);
  });

  it('treats nonsensical headroom as none', () => {
    expect(isMonthlyCashbackCapReached(Number.NaN)).toBe(true);
    expect(isMonthlyCashbackCapReached(-3)).toBe(true);
  });
});

/** A cardholder with $8 settled this month in dollars and a euro month of their own. */
const usdMonth = {
  cashbackThisMonth: 8,
  cashbackPendingThisMonth: 2,
  maxCashbackMonthly: 100,
  cashbackCapThisMonth: 100,
  cashbackHeadroomThisMonth: 90,
};
const eurMonth = {
  cashbackThisMonth: 12.4,
  cashbackPendingThisMonth: 1.6,
  cashbackLastMonth: 20,
  maxCashbackMonthly: 50,
  cashbackCapThisMonth: 50,
  cashbackHeadroomThisMonth: 36,
};
const rewardsFor = (overrides: Partial<RewardsUserData>): RewardsUserData =>
  ({ ...usdMonth, ...overrides }) as RewardsUserData;
const cardCashback = (overrides: Partial<CashbackData>): CashbackData =>
  ({ totalUsdValue: 0, ...overrides }) as CashbackData;

describe('resolveCashbackMonth', () => {
  it("reads a euro cardholder's month from the euro block, in EUR", () => {
    const month = resolveCashbackMonth(
      rewardsFor({ cashbackCurrency: 'EUR', cashbackEur: eurMonth }),
    );

    expect(month).toMatchObject({ currency: 'EUR', ...eurMonth });
    // The euro caps are what the cap and headroom helpers then measure.
    expect(monthlyCashbackCap(month)).toBe(50);
    expect(monthlyCashbackHeadroom(month, 14)).toBe(36);
  });

  it('reads a dollar cardholder exactly as before', () => {
    for (const cashbackCurrency of ['USD', undefined] as const) {
      expect(resolveCashbackMonth(rewardsFor({ cashbackCurrency }))).toEqual({
        currency: 'USD',
        ...usdMonth,
      });
    }
  });

  it('stays in dollars, and says so, when a euro block is missing', () => {
    expect(resolveCashbackMonth(rewardsFor({ cashbackCurrency: 'EUR' }))?.currency).toBe('USD');
  });

  it('reads nothing before the rewards data lands', () => {
    expect(resolveCashbackMonth(undefined)).toBeUndefined();
  });
});

describe('cashbackFiguresByCurrency', () => {
  it("lists the cardholder's own currency first and never adds the two", () => {
    expect(cashbackFiguresByCurrency({ USD: 150, EUR: 12.4 }, 'EUR')).toEqual([
      { value: 12.4, currency: 'EUR' },
      { value: 150, currency: 'USD' },
    ]);
  });

  it('always lists the own currency, and the other only when there is some', () => {
    expect(cashbackFiguresByCurrency({ USD: 0, EUR: 0 }, 'EUR')).toEqual([
      { value: 0, currency: 'EUR' },
    ]);
    expect(cashbackFiguresByCurrency({ USD: 25 }, 'USD')).toEqual([{ value: 25, currency: 'USD' }]);
  });
});

describe('resolveLifetimeCashback', () => {
  it("takes the backend's lifetime figure, escrow included, over the card's paid total", () => {
    // Paid on every card held plus escrow, worked out server-side; the card's
    // own paid total misses a retired card's history.
    expect(
      resolveLifetimeCashback(
        rewardsFor({ cashbackLifetime: 131.75 }),
        cardCashback({ totalUsdValue: 25 }),
      ),
    ).toEqual({ lifetimeCashback: 131.75, lifetimeCashbackOther: undefined });
  });

  it("counts a new cardholder's escrowed cashback rather than reading $0", () => {
    expect(
      resolveLifetimeCashback(
        rewardsFor({ cashbackThisMonth: 0, cashbackPendingThisMonth: 3.2, cashbackLifetime: 3.2 }),
        cardCashback({}),
      ).lifetimeCashback,
    ).toBeCloseTo(3.2);
  });

  it("never reads below this month's figure", () => {
    expect(
      resolveLifetimeCashback(rewardsFor({ cashbackLifetime: 5 }), cardCashback({}))
        .lifetimeCashback,
    ).toBe(10);
  });

  describe('without a lifetime figure from the backend', () => {
    it("takes the card's paid total, floored at this month's figure", () => {
      expect(resolveLifetimeCashback(rewardsFor({}), cardCashback({ totalUsdValue: 25 }))).toEqual({
        lifetimeCashback: 25,
        lifetimeCashbackOther: undefined,
        lifetimeCashbackIsPartial: true,
      });
      // The details lag behind this month's settled and escrowed $10.
      expect(resolveLifetimeCashback(rewardsFor({}), cardCashback({ totalUsdValue: 3 }))).toEqual({
        lifetimeCashback: 10,
        lifetimeCashbackOther: undefined,
        lifetimeCashbackIsPartial: true,
      });
    });

    it('never counts a payout twice when the card details are newer than the rewards data', () => {
      // $120 paid + $9 pending; the $9 then pays out. The card details already
      // say $129 while the cached rewards data still says $9 pending: $129,
      // not $138.
      expect(
        resolveLifetimeCashback(
          rewardsFor({ cashbackThisMonth: 20, cashbackPendingThisMonth: 9 }),
          cardCashback({ totalUsdValue: 129 }),
        ).lifetimeCashback,
      ).toBe(129);
    });

    it('shows the card total while the rewards data is still loading', () => {
      expect(resolveLifetimeCashback(undefined, cardCashback({ totalUsdValue: 42.5 }))).toEqual({
        lifetimeCashback: 42.5,
        lifetimeCashbackOther: undefined,
      });
      expect(resolveLifetimeCashback(undefined, undefined).lifetimeCashback).toBe(0);
    });
  });

  it('gives a euro cardholder their euro lifetime, with any dollar lifetime beside it', () => {
    const result = resolveLifetimeCashback(
      rewardsFor({ cashbackCurrency: 'EUR', cashbackEur: eurMonth }),
      cardCashback({
        currency: 'EUR',
        totalUsdValue: 150,
        eur: {
          monthlySoEurAmount: 0,
          monthlyEurValue: 0,
          monthlyPendingEurValue: 0,
          totalSoEurAmount: 9,
          totalEurValue: 9.2,
        },
      }),
    );

    // €14.00 (this month's settled and escrowed euros beat the lagging €9.20)
    // and $150 — not €164.
    expect(result).toEqual({
      lifetimeCashback: 14,
      lifetimeCashbackOther: { value: 150, currency: 'USD' },
      lifetimeCashbackIsPartial: true,
    });
  });

  it("takes each currency's lifetime from the backend when it sends both", () => {
    expect(
      resolveLifetimeCashback(
        rewardsFor({
          cashbackCurrency: 'EUR',
          cashbackEur: { ...eurMonth, cashbackLifetime: 33.5 },
          cashbackLifetime: 151.2,
        }),
        cardCashback({ totalUsdValue: 150 }),
      ),
    ).toEqual({
      lifetimeCashback: 33.5,
      lifetimeCashbackOther: { value: 151.2, currency: 'USD' },
    });
  });

  it('leaves the dollar side out for a euro cardholder who never earned in dollars', () => {
    expect(
      resolveLifetimeCashback(
        rewardsFor({
          cashbackCurrency: 'EUR',
          cashbackEur: eurMonth,
          cashbackThisMonth: 0,
          cashbackPendingThisMonth: 0,
        }),
        cardCashback({ currency: 'EUR' }),
      ),
    ).toEqual({
      lifetimeCashback: 14,
      lifetimeCashbackOther: undefined,
      lifetimeCashbackIsPartial: true,
    });
  });

  describe('lifetimeCashbackIsPartial', () => {
    it("is unset when every figure on show is the backend's", () => {
      expect(
        resolveLifetimeCashback(rewardsFor({ cashbackLifetime: 40 }), cardCashback({}))
          .lifetimeCashbackIsPartial,
      ).toBeUndefined();
    });

    it('is set when the figure on show is the fallback', () => {
      expect(
        resolveLifetimeCashback(rewardsFor({}), cardCashback({ totalUsdValue: 25 }))
          .lifetimeCashbackIsPartial,
      ).toBe(true);
    });

    it("is set when only the other currency's figure is the fallback", () => {
      // Euros from the backend, dollars beside them from the card details.
      expect(
        resolveLifetimeCashback(
          rewardsFor({
            cashbackCurrency: 'EUR',
            cashbackEur: { ...eurMonth, cashbackLifetime: 33.5 },
          }),
          cardCashback({ totalUsdValue: 150 }),
        ),
      ).toEqual({
        lifetimeCashback: 33.5,
        lifetimeCashbackOther: { value: 150, currency: 'USD' },
        lifetimeCashbackIsPartial: true,
      });
    });

    it('is unset while the rewards data is still loading', () => {
      expect(
        resolveLifetimeCashback(undefined, cardCashback({ totalUsdValue: 25 }))
          .lifetimeCashbackIsPartial,
      ).toBeUndefined();
    });
  });

  it('treats nonsensical amounts as nothing', () => {
    expect(
      resolveLifetimeCashback(
        rewardsFor({
          cashbackThisMonth: 0,
          cashbackPendingThisMonth: 0,
          cashbackLifetime: Number.NaN,
        }),
        cardCashback({ totalUsdValue: Number.NaN }),
      ).lifetimeCashback,
    ).toBe(0);
  });
});
