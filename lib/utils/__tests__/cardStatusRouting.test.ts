/// <reference types="jest" />
import { CardProvider, CardStatus, type CardStatusResponse } from '@/lib/types';
import { hasCard, hasPendingCard, resolveCardIssuer } from '@/lib/utils/cardStatusRouting';

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

/**
 * Every card consumer branches on `provider === RAIN` to decide whether
 * Rain-only endpoints apply. Reporting Rain for a Wirex card is what sent the
 * card-details reveal to Rain's `/cards/secrets` and produced
 * "Card reveal via SessionId is only supported for Rain cards".
 */
describe('resolveCardIssuer', () => {
  const active = (provider?: CardProvider) =>
    ({ status: CardStatus.ACTIVE, provider }) as CardStatusResponse;

  it('reports Wirex for an active Wirex card', () => {
    expect(resolveCardIssuer({ cardStatus: active(CardProvider.WIREX) })).toBe(CardProvider.WIREX);
  });

  it('reports Rain for an active Rain card', () => {
    expect(resolveCardIssuer({ cardStatus: active(CardProvider.RAIN) })).toBe(CardProvider.RAIN);
  });

  it('falls back to the issuer on card details when status has not loaded', () => {
    expect(
      resolveCardIssuer({
        cardStatus: null,
        cardDetails: { id: 'card-1', provider: CardProvider.WIREX },
      }),
    ).toBe(CardProvider.WIREX);
  });

  it('prefers the issuer from card status when both are present', () => {
    expect(
      resolveCardIssuer({
        cardStatus: active(CardProvider.WIREX),
        cardDetails: { id: 'card-1', provider: CardProvider.RAIN },
      }),
    ).toBe(CardProvider.WIREX);
  });

  it('treats a card with no reported issuer as Rain (legacy rows)', () => {
    // The provider field postdates those cards, and they are all Rain.
    expect(resolveCardIssuer({ cardStatus: active() })).toBe(CardProvider.RAIN);
  });

  it('reports no issuer for a Bridge-only card', () => {
    expect(resolveCardIssuer({ cardStatus: active(CardProvider.BRIDGE) })).toBeNull();
    expect(
      resolveCardIssuer({ cardDetails: { id: 'card-1', provider: CardProvider.BRIDGE } }),
    ).toBeNull();
  });

  it('reports no issuer before a card exists, so nothing fetches during KYC', () => {
    // /cards/status names the issuer during KYC too; that must not start
    // issuer-specific queries for a card that has not been created.
    expect(
      resolveCardIssuer({ cardStatus: { provider: CardProvider.WIREX } as CardStatusResponse }),
    ).toBeNull();
    expect(resolveCardIssuer({})).toBeNull();
  });

  it('reports Wirex for a pending Wirex card once details exist', () => {
    // hasCard is false while pending, but the details response resolves, and the
    // issuer must still be named so the reveal does not fall through to Rain.
    expect(
      resolveCardIssuer({
        cardStatus: {
          status: CardStatus.PENDING,
          provider: CardProvider.WIREX,
        } as CardStatusResponse,
        cardDetails: { id: 'card-1', provider: CardProvider.WIREX },
      }),
    ).toBe(CardProvider.WIREX);
  });

  it('honours the build-level issuer override', () => {
    expect(
      resolveCardIssuer({
        cardStatus: active(CardProvider.RAIN),
        issuerOverride: CardProvider.WIREX,
      }),
    ).toBe(CardProvider.WIREX);
  });
});
