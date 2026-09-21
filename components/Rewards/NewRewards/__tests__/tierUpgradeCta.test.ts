import { tierUpgradeCta } from '@/components/Rewards/NewRewards/tierUpgradeCta';
import { RewardsTier } from '@/lib/types';

const { CORE, PRIME, ULTRA } = RewardsTier;

const cta = (overrides: Partial<Parameters<typeof tierUpgradeCta>[0]> = {}) =>
  tierUpgradeCta({
    selectedTier: PRIME,
    currentTier: CORE,
    unavailable: false,
    pending: false,
    routes: [],
    ...overrides,
  });

describe('tierUpgradeCta', () => {
  /**
   * The bug. v3 sells Prime for a lock or an annual fee, and the footer only
   * ever asked the v2 skip-the-line config — which is off — so the one tier the
   * user could actually buy read "Tier unavailable".
   */
  it('offers a tier that v3 is selling, with v2 switched off', () => {
    expect(cta({ routes: ['cash', 'lock'], remainingFuse: undefined })).toEqual({
      label: 'Upgrade',
      subtitle: 'Lock FUSE or pay the annual fee',
      enabled: true,
      held: false,
    });
  });

  it('names the only route when a tier is sold just one way', () => {
    expect(cta({ selectedTier: ULTRA, routes: ['lock'] }).subtitle).toBe(
      'Lock FUSE to hold the tier',
    );
    expect(cta({ routes: ['cash'] }).subtitle).toBe('Pay the annual fee to hold the tier');
  });

  it('reads the routes as a set, not in the order they arrived', () => {
    expect(cta({ routes: ['lock', 'cash'] }).subtitle).toBe(
      cta({ routes: ['cash', 'lock'] }).subtitle,
    );
  });

  it('still offers a v2 unlock when that is the program running', () => {
    expect(cta({ routes: [], remainingFuse: 50_000 })).toEqual({
      label: 'Upgrade',
      subtitle: 'Deposit 50,000 FUSE to Savings to upgrade',
      enabled: true,
      held: false,
    });
  });

  /**
   * Says why, rather than borrowing the held cases' "Your membership benefits"
   * — which told a user looking at a tier they do not have that they were
   * looking at their own. And `held` stays false: the footer has something to
   * say here, so it stays on screen.
   */
  it('is unavailable, and says so, when neither program sells the tier', () => {
    expect(cta({ routes: [], remainingFuse: undefined })).toEqual({
      label: 'Tier unavailable',
      subtitle: 'Not on sale right now',
      enabled: false,
      held: false,
    });
  });

  it('never offers the tier the user is already on, however it is sold', () => {
    expect(cta({ selectedTier: CORE, routes: ['lock'] }).enabled).toBe(false);
    expect(cta({ selectedTier: CORE, routes: ['lock'] }).label).toBe('Current tier');
  });

  it('never offers a tier below the one held', () => {
    expect(cta({ selectedTier: PRIME, currentTier: ULTRA, routes: ['lock'] })).toEqual({
      label: 'Included in your tier',
      subtitle: 'Your membership benefits',
      enabled: false,
      held: true,
    });
  });

  /** An upgrade already signed for, waiting on the backend to agree. */
  it('holds the button while a purchase is being reconciled', () => {
    expect(cta({ pending: true, routes: ['cash', 'lock'] })).toEqual({
      label: 'Confirming tier…',
      subtitle: 'Savings changed. Waiting for rewards confirmation.',
      enabled: false,
      held: false,
    });
  });

  /**
   * What the footer hides on. The old rule was `selectedTier !== currentTier`,
   * which hid it on exactly one tab — so a user on Ultra swiping to Prime, or
   * to Core, got a full-width dead button over benefits they already had.
   */
  describe('held', () => {
    it('covers the tier the user is on and every tier under it', () => {
      expect(cta({ selectedTier: ULTRA, currentTier: ULTRA }).held).toBe(true);
      expect(cta({ selectedTier: PRIME, currentTier: ULTRA }).held).toBe(true);
      expect(cta({ selectedTier: CORE, currentTier: ULTRA }).held).toBe(true);
      expect(cta({ selectedTier: CORE, currentTier: PRIME }).held).toBe(true);
    });

    /** A tier still to be bought keeps its footer, sellable or not. */
    it('is false for a tier above the one held', () => {
      expect(cta({ selectedTier: ULTRA, currentTier: PRIME, routes: ['lock'] }).held).toBe(false);
      expect(cta({ selectedTier: ULTRA, currentTier: PRIME, routes: [] }).held).toBe(false);
      expect(cta({ selectedTier: PRIME, currentTier: CORE, routes: ['cash'] }).held).toBe(false);
    });

    /**
     * Not knowing is not the same as having it. Hiding the footer on a
     * membership that has not loaded would pull it out from under the user's
     * thumb and put it back a moment later.
     */
    it('is false while the membership is unknown or reconciling', () => {
      expect(cta({ selectedTier: ULTRA, currentTier: ULTRA, unavailable: true }).held).toBe(false);
      expect(cta({ selectedTier: ULTRA, currentTier: undefined }).held).toBe(false);
      expect(cta({ selectedTier: PRIME, currentTier: CORE, pending: true }).held).toBe(false);
    });

    /**
     * `currentTier` and `offerHeld` come from two endpoints with two caches, so
     * one can be a beat behind the other. Offering a tier someone already holds
     * is the worse mistake, so either source is enough to stop.
     */
    it('takes the membership offer at its word when the rewards tier lags', () => {
      expect(cta({ selectedTier: ULTRA, currentTier: CORE, offerHeld: true }).held).toBe(true);
      expect(cta({ selectedTier: ULTRA, currentTier: undefined, offerHeld: true }).held).toBe(true);
      expect(cta({ selectedTier: ULTRA, unavailable: true, offerHeld: true }).held).toBe(true);
    });

    /** ...and the other way round, when the membership is the stale one. */
    it('still hides on the rewards tier when the offer has not caught up', () => {
      expect(cta({ selectedTier: PRIME, currentTier: ULTRA, offerHeld: false }).held).toBe(true);
    });

    /**
     * A reconciliation that has landed is over. Holding "Confirming tier…" on
     * screen after the membership agrees is a slower way of saying nothing.
     */
    it('beats a pending reconciliation once the tier has actually landed', () => {
      const result = cta({ selectedTier: PRIME, currentTier: PRIME, pending: true });

      expect(result.held).toBe(true);
      expect(result.label).not.toBe('Confirming tier…');
    });
  });

  it('fails closed while the current tier is unknown', () => {
    expect(cta({ unavailable: true, routes: ['cash', 'lock'] })).toEqual({
      label: 'Tier unavailable',
      subtitle: 'Checking your current membership',
      enabled: false,
      held: false,
    });
    expect(cta({ currentTier: undefined, routes: ['cash', 'lock'] }).enabled).toBe(false);
  });
});
