import {
  isMonthlyCashbackCapReached,
  monthlyCashbackCap,
  monthlyCashbackHeadroom,
  monthlyCashbackTotal,
  resolveCashbackProgress,
} from '@/lib/cashbackProgress';

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
