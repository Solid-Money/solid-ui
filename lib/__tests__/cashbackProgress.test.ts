import { resolveCashbackProgress } from '@/lib/cashbackProgress';

describe('resolveCashbackProgress', () => {
  it('splits the track between settled and pending cashback', () => {
    expect(resolveCashbackProgress({ earned: 30, pending: 15, cap: 150 })).toEqual({
      earnedPct: 20,
      pendingPct: 10,
    });
  });

  it('starts the pending segment at zero earned', () => {
    // The case this whole line exists for: a purchase made today, nothing paid.
    expect(resolveCashbackProgress({ earned: 0, pending: 3, cap: 150 })).toEqual({
      earnedPct: 0,
      pendingPct: 2,
    });
  });

  it('gives pending only what is left of the track', () => {
    // Together they would be 120% — the pair fills the line, never overflows it.
    expect(resolveCashbackProgress({ earned: 120, pending: 60, cap: 150 })).toEqual({
      earnedPct: 80,
      pendingPct: 20,
    });
  });

  it('leaves no room for pending once earned fills the track', () => {
    expect(resolveCashbackProgress({ earned: 200, pending: 40, cap: 150 })).toEqual({
      earnedPct: 100,
      pendingPct: 0,
    });
  });

  it('fills nothing when no cap is configured', () => {
    // A full bar would claim the user had maxed out a cap that does not exist.
    expect(resolveCashbackProgress({ earned: 10, pending: 5, cap: 0 })).toEqual({
      earnedPct: 0,
      pendingPct: 0,
    });
  });

  it('treats missing and nonsensical amounts as nothing earned', () => {
    expect(
      resolveCashbackProgress({
        earned: Number.NaN,
        pending: undefined as unknown as number,
        cap: 150,
      }),
    ).toEqual({ earnedPct: 0, pendingPct: 0 });

    expect(resolveCashbackProgress({ earned: -20, pending: -5, cap: 150 })).toEqual({
      earnedPct: 0,
      pendingPct: 0,
    });
  });
});
