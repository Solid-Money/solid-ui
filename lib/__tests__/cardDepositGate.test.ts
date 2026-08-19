import { CardProvider } from '@/lib/types';
import { canDepositToCard } from '@/lib/utils/cardHelpers';

/**
 * "Add funds" and the Authorize control are the same step in the journey served by
 * two different mechanisms, and this predicate is what every entry point (the card
 * action row, the wallet balance breakdown, the wallet action bar, and the deposit
 * modal itself) uses to pick one. If they ever disagree, a Wirex cardholder gets
 * offered a transfer with no destination.
 */
describe('canDepositToCard', () => {
  it('allows depositing to a Rain card — it is prefunded', () => {
    expect(canDepositToCard(CardProvider.RAIN)).toBe(true);
  });

  it('refuses a Wirex card — it holds no balance to deposit into', () => {
    // Wirex pays the merchant from its own Master Account and our backend takes the
    // soUSD from the user's Safe on settlement, so their savings IS their card
    // balance. They authorize an allowance instead.
    expect(canDepositToCard(CardProvider.WIREX)).toBe(false);
  });

  it('allows depositing to a legacy Bridge card', () => {
    expect(canDepositToCard(CardProvider.BRIDGE)).toBe(true);
  });

  it('allows deposits while the issuer is still resolving', () => {
    // Fails open on purpose: the provider comes from a query, and a Rain cardholder
    // must not lose "Add funds" for the moment it takes to load.
    expect(canDepositToCard(null)).toBe(true);
    expect(canDepositToCard(undefined)).toBe(true);
  });
});
