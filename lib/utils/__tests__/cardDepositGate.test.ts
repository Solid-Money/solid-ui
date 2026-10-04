import { MINIMUM_CARD_DEPOSIT_USD } from '@/constants/card';
import { CardProvider } from '@/lib/types';
import {
  hasMetCardDeposit,
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


describe('hasMetCardDeposit', () => {
  // Legacy: collateral funded onto an issued card, reported in cents.
  it('compares card collateral in cents against the same minimum', () => {
    expect(hasMetCardDeposit(MINIMUM_CARD_DEPOSIT_USD * 100)).toBe(true);
    expect(hasMetCardDeposit(500)).toBe(false);
    expect(hasMetCardDeposit(null)).toBe(false);
  });
});
