import { CardProvider } from '@/lib/types';
import { canRevealCardDetails } from '@/lib/utils/cardHelpers';

/**
 * The gate on the card-details reveal. A Wirex card spends by our backend debiting the
 * user's Safe, so one with the `SolidCashModule` off declines every payment — and the
 * numbers of a card that cannot pay read exactly like the numbers of one that can.
 *
 * The cases that matter are the ones where the answer is not yet known: a chain read
 * still in flight, or one that failed, arrives here as `canCardSpend: false`, and must
 * block rather than fall open.
 */
describe('canRevealCardDetails', () => {
  it('reveals a Wirex card once the module can spend from the Safe', () => {
    expect(canRevealCardDetails({ provider: CardProvider.WIREX, canCardSpend: true })).toBe(true);
  });

  it('blocks a Wirex card whose Safe cannot be debited', () => {
    // Covers both halves of the module's verdict: never registered, and registered
    // with the module since disabled. Either way the card declines.
    expect(canRevealCardDetails({ provider: CardProvider.WIREX, canCardSpend: false })).toBe(false);
  });

  it('always reveals a Rain card, which is prefunded and has no module', () => {
    expect(canRevealCardDetails({ provider: CardProvider.RAIN, canCardSpend: false })).toBe(true);
  });

  it('reveals while the issuer is unresolved, matching canDepositToCard', () => {
    // A card with no SolidCashModule behind it cannot be blocked on one, and the
    // reveal request itself needs the issuer to know which flow to run.
    expect(canRevealCardDetails({ provider: null, canCardSpend: false })).toBe(true);
    expect(canRevealCardDetails({ provider: undefined, canCardSpend: false })).toBe(true);
  });
});
