/// <reference types="jest" />
import { CardProvider, CardStatus, type CardStatusResponse } from '@/lib/types';
import { hasCard, hasPendingCard } from '@/lib/utils/cardStatusRouting';

const cardStatus = (overrides: Partial<CardStatusResponse> = {}): CardStatusResponse =>
  ({ ...overrides }) as CardStatusResponse;

/**
 * `hasCard` and `hasPendingCard` decide where a user in the card flow is sent, so
 * the boundary between them is what keeps a mid-issuance user out of onboarding.
 *
 * A Wirex virtual card is `pending` between issuance and the issuer opening it —
 * a card that exists but is not yet usable. `hasCard` (usable) must stay false
 * there, while `hasPendingCard` (exists) must be true, or the routing sends the
 * user back to country selection and restarts onboarding they already finished.
 */
describe('card status routing predicates', () => {
  describe('hasPendingCard', () => {
    it('is true for a Wirex card awaiting issuance', () => {
      expect(
        hasPendingCard(cardStatus({ status: CardStatus.PENDING, provider: CardProvider.WIREX })),
      ).toBe(true);
    });

    it('is true for a pending card with no provider reported', () => {
      // /cards/status has historically omitted the provider; a pending card is
      // still a card, so routing must not depend on that field being present.
      expect(hasPendingCard(cardStatus({ status: CardStatus.PENDING }))).toBe(true);
    });

    it('is false for the deprecated Bridge provider', () => {
      expect(
        hasPendingCard(cardStatus({ status: CardStatus.PENDING, provider: CardProvider.BRIDGE })),
      ).toBe(false);
    });

    it.each([CardStatus.ACTIVE, CardStatus.FROZEN, CardStatus.INACTIVE])(
      'is false once the card reaches %s',
      status => {
        expect(hasPendingCard(cardStatus({ status, provider: CardProvider.WIREX }))).toBe(false);
      },
    );

    it('is false with no card at all', () => {
      expect(hasPendingCard(cardStatus())).toBe(false);
      expect(hasPendingCard(null)).toBe(false);
      expect(hasPendingCard(undefined)).toBe(false);
    });
  });

  describe('hasCard stays "usable card only"', () => {
    it('does not count a pending card as usable', () => {
      const pending = cardStatus({
        status: CardStatus.PENDING,
        provider: CardProvider.WIREX,
      });

      expect(hasCard(pending)).toBe(false);
      expect(hasPendingCard(pending)).toBe(true);
    });

    it('counts an active Wirex card', () => {
      expect(hasCard(cardStatus({ status: CardStatus.ACTIVE, provider: CardProvider.WIREX }))).toBe(
        true,
      );
    });
  });

  it('classifies every card into exactly one of the two states', () => {
    // The routing branches are mutually exclusive by construction: a card cannot
    // be both "usable" and "waiting to be issued", so no screen can receive
    // contradictory redirects.
    for (const status of [
      CardStatus.PENDING,
      CardStatus.ACTIVE,
      CardStatus.FROZEN,
      CardStatus.INACTIVE,
    ]) {
      const value = cardStatus({ status, provider: CardProvider.WIREX });
      expect(hasCard(value) && hasPendingCard(value)).toBe(false);
    }
  });
});
