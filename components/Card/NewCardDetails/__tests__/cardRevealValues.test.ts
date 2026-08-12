/// <reference types="jest" />
import {
  groupCardNumber,
  resolveCardRevealValues,
} from '@/components/Card/NewCardDetails/cardRevealValues';

/**
 * The reveal face must never invent card data.
 *
 * It used to substitute the Figma placeholders (6483 6483 6483 6483, 12/27, 234,
 * JOHN DOE) whenever a reveal failed, so a failure rendered a plausible-looking
 * card the user could try to spend — and read as the feature working when it had
 * not. Missing values now render as masks, and the copyable number stays empty.
 */
describe('resolveCardRevealValues', () => {
  const revealed = {
    card_number: '4111111111111111',
    card_security_code: '123',
    expiry_date: '12/2027',
  };

  it('renders the real values when the reveal succeeded', () => {
    const values = resolveCardRevealValues({
      revealed,
      cardholderName: { first_name: 'Alex', last_name: 'Grey' },
      issuingCountry: 'Lithuania',
    });

    expect(values.numberPlain).toBe('4111111111111111');
    expect(values.number).toBe('4111   1111   1111   1111');
    expect(values.expiry).toBe('12/27');
    expect(values.cvv).toBe('123');
    expect(values.nameOnCard).toBe('ALEX GREY');
    expect(values.issuingCountry).toBe('Lithuania');
  });

  describe('when the reveal failed', () => {
    const values = resolveCardRevealValues({ revealed: null });

    it('never renders digits that could pass for a card number', () => {
      expect(values.number).not.toMatch(/\d/);
      expect(values.expiry).not.toMatch(/\d/);
      expect(values.cvv).not.toMatch(/\d/);
    });

    it('leaves the copyable number empty, so nothing fake reaches the clipboard', () => {
      expect(values.numberPlain).toBe('');
    });

    it('does not invent a cardholder name or country', () => {
      expect(values.nameOnCard).toBe('');
      expect(values.issuingCountry).toBe('');
    });
  });

  it('masks only the parts the issuer withheld', () => {
    // Wirex serves the CVV from a separate endpoint, so a PAN can arrive without
    // one; the number must still be real and copyable.
    const values = resolveCardRevealValues({
      revealed: { ...revealed, card_security_code: '' },
    });

    expect(values.numberPlain).toBe('4111111111111111');
    expect(values.cvv).not.toMatch(/\d/);
  });

  describe('expiry formatting', () => {
    it.each([
      ['12/2027', '12/27'], // Wirex MM/YYYY
      ['12/27', '12/27'], // Rain MM/YY, passed through
      ['2027-12-31', '12/27'], // Bridge ISO date
    ])('formats %s as %s', (input, expected) => {
      const values = resolveCardRevealValues({
        revealed: { ...revealed, expiry_date: input },
      });
      expect(values.expiry).toBe(expected);
    });

    it('passes through an unparseable value rather than inventing one', () => {
      const values = resolveCardRevealValues({
        revealed: { ...revealed, expiry_date: 'not-a-date' },
      });
      expect(values.expiry).toBe('not-a-date');
    });
  });

  describe('groupCardNumber', () => {
    it('groups into fours', () => {
      expect(groupCardNumber('4111111111111111')).toBe('4111   1111   1111   1111');
    });

    it('regroups a number that already contains spaces', () => {
      expect(groupCardNumber('4111 1111 1111 1111')).toBe('4111   1111   1111   1111');
    });

    it('does not pad a short trailing group', () => {
      // 15-digit PANs (Amex) must not gain characters.
      expect(groupCardNumber('411111111111111')).toBe('4111   1111   1111   111');
    });
  });
});
