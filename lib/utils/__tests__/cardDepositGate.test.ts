import { MINIMUM_CARD_DEPOSIT_USD } from '@/constants/card';
import { CardProvider } from '@/lib/types';
import {
  hasMetCardDeposit,
  hasMetSavingsDeposit,
  requiresCardDeposit,
} from '@/lib/utils/cardDepositGate';

/**
 * Which applicants are asked for a deposit.
 *
 * The property worth pinning is that no COUNTRY appears anywhere in it. The old
 * gate was a single-country check run against a client-detected country, so a
 * VPN turned it off; the answer now comes from the backend, with the resolved
 * issuer as the only fallback.
 */
describe('requiresCardDeposit', () => {
  it("takes the backend's answer whenever it has one", () => {
    expect(requiresCardDeposit({ depositRequired: true })).toBe(true);
    expect(requiresCardDeposit({ depositRequired: false })).toBe(false);
  });

  it('ignores the issuer when the backend has answered', () => {
    // The server decides from the user's own record; a client-side guess must
    // never be able to talk it out of the requirement.
    expect(requiresCardDeposit({ depositRequired: true, issuer: CardProvider.WIREX })).toBe(true);
    expect(requiresCardDeposit({ depositRequired: false, issuer: CardProvider.RAIN })).toBe(false);
  });

  it('falls back to the issuer before a card customer exists', () => {
    // /cards/status 404s until then, which is exactly when the activation screen
    // still has to decide what to render.
    expect(requiresCardDeposit({ issuer: CardProvider.RAIN })).toBe(true);
    expect(requiresCardDeposit({ issuer: CardProvider.WIREX })).toBe(false);
    expect(requiresCardDeposit({ issuer: CardProvider.BRIDGE })).toBe(false);
  });

  it('shows the step when the issuer is unresolved', () => {
    // Rain is the default flow, and the server refuses the application anyway.
    // Showing the step to someone who turns out not to need it is a much smaller
    // cost than hiding it from someone who does and letting them hit a refusal
    // they were never warned about.
    expect(requiresCardDeposit({})).toBe(true);
    expect(requiresCardDeposit({ issuer: null })).toBe(true);
  });
});

describe('hasMetSavingsDeposit', () => {
  it('clears a position at or above the minimum', () => {
    expect(hasMetSavingsDeposit(MINIMUM_CARD_DEPOSIT_USD)).toBe(true);
    expect(hasMetSavingsDeposit(120)).toBe(true);
  });

  it('refuses a position well below it', () => {
    expect(hasMetSavingsDeposit(4)).toBe(false);
    expect(hasMetSavingsDeposit(0)).toBe(false);
    expect(hasMetSavingsDeposit(null)).toBe(false);
    expect(hasMetSavingsDeposit(undefined)).toBe(false);
  });

  it('absorbs the few cents a $10 transfer loses on the way in', () => {
    // Bridge/on-ramp fees plus share-rate rounding land a genuine $10 deposit
    // just under the bar; without the tolerance those users are stranded with
    // no way to see why.
    expect(hasMetSavingsDeposit(9.7)).toBe(true);
  });

  it('does not absorb a materially smaller deposit', () => {
    expect(hasMetSavingsDeposit(8)).toBe(false);
  });

  it('follows a minimum served by the backend instead of the built-in default', () => {
    // The bar can move without an app release.
    expect(hasMetSavingsDeposit(20, 25)).toBe(false);
    expect(hasMetSavingsDeposit(25, 25)).toBe(true);
  });
});

describe('hasMetCardDeposit', () => {
  // Legacy: collateral funded onto an issued card, reported in cents.
  it('compares card collateral in cents against the same minimum', () => {
    expect(hasMetCardDeposit(MINIMUM_CARD_DEPOSIT_USD * 100)).toBe(true);
    expect(hasMetCardDeposit(500)).toBe(false);
    expect(hasMetCardDeposit(null)).toBe(false);
  });
});
