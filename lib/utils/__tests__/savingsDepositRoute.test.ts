import { CardProvider } from '@/lib/types';
import { usesDirectSavingsDeposit } from '@/lib/utils/cardHelpers';

/**
 * Which flow the savings Deposit button opens. Not a styling choice: one brings
 * new money in from outside, the other moves a balance already in Solid, so this
 * decides what the button can do.
 */
describe('usesDirectSavingsDeposit', () => {
  // Rain's wallet, card and savings are three separate pots, so the savings
  // button is the only way new money reaches the vault directly.
  it('gives Rain cardholders the direct-deposit flow', () => {
    expect(usesDirectSavingsDeposit(CardProvider.RAIN)).toBe(true);
  });

  // A Wirex cardholder funds savings by funding their wallet, which the wallet
  // deposit flow already covers — leaving the savings button to move what is
  // already here.
  it('gives Wirex cardholders the amount form', () => {
    expect(usesDirectSavingsDeposit(CardProvider.WIREX)).toBe(false);
  });

  // A user with no card, and one whose issuer has not resolved yet, fall on the
  // same side as Rain — the default canDepositToCard takes.
  it('treats no card and an unresolved issuer as not Wirex', () => {
    expect(usesDirectSavingsDeposit(null)).toBe(true);
    expect(usesDirectSavingsDeposit(undefined)).toBe(true);
  });
});
