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
      subtitle: 'Lock soFUSE or pay the annual fee',
      enabled: true,
    });
  });

  it('names the only route when a tier is sold just one way', () => {
    expect(cta({ selectedTier: ULTRA, routes: ['lock'] }).subtitle).toBe(
      'Lock soFUSE from your Savings to hold the tier',
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
    });
  });

  it('is unavailable when neither program sells the tier', () => {
    expect(cta({ routes: [], remainingFuse: undefined })).toEqual({
      label: 'Tier unavailable',
      subtitle: 'Your membership benefits',
      enabled: false,
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
    });
  });

  /** An upgrade already signed for, waiting on the backend to agree. */
  it('holds the button while a purchase is being reconciled', () => {
    expect(cta({ pending: true, routes: ['cash', 'lock'] })).toEqual({
      label: 'Confirming tier…',
      subtitle: 'Savings changed. Waiting for rewards confirmation.',
      enabled: false,
    });
  });

  it('fails closed while the current tier is unknown', () => {
    expect(cta({ unavailable: true, routes: ['cash', 'lock'] })).toEqual({
      label: 'Tier unavailable',
      subtitle: 'Checking your current membership',
      enabled: false,
    });
    expect(cta({ currentTier: undefined, routes: ['cash', 'lock'] }).enabled).toBe(false);
  });
});
