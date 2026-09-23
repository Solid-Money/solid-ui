import { CardProvider } from '@/lib/types';
import { usesNewDepositDesign } from '@/lib/utils/cardHelpers';

/**
 * Which deposit screens a cardholder is shown. The redesign shipped with Wirex;
 * Rain cardholders stay on the flows they already know, and their deposits land
 * somewhere different, so the split is by issuer rather than by feature flag.
 */
describe('usesNewDepositDesign', () => {
  it('shows the redesigned flows to Wirex cardholders', () => {
    expect(usesNewDepositDesign(CardProvider.WIREX)).toBe(true);
  });

  it('keeps Rain cardholders on the flows they know', () => {
    expect(usesNewDepositDesign(CardProvider.RAIN)).toBe(false);
  });

  // An unresolved issuer must not flip the design for a frame while the query
  // settles — the same default canDepositToCard takes.
  it('treats an unresolved issuer as Rain', () => {
    expect(usesNewDepositDesign(null)).toBe(false);
    expect(usesNewDepositDesign(undefined)).toBe(false);
  });
});
