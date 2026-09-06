import { monthlyCashbackTotal, resolveCashbackProgress } from '@/lib/cashbackProgress';

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
