import {
  EMPTY_TRANSFER_FORM,
  toEstimateRequest,
  validateTransferForm,
  WirexTransferFormState,
} from '@/components/WirexBankAccount/transferFormState';
import { WirexBankAccountType } from '@/lib/types/wirex-bank';

/** A form that passes every rule, so each case can deviate by exactly one field. */
const validSepa: WirexTransferFormState = {
  ...EMPTY_TRANSFER_FORM,
  amount: '100',
  firstName: 'Alex',
  lastName: 'Grey',
  iban: 'DE89370400440532013000',
  bic: 'COBADEFFXXX',
};

const validAch: WirexTransferFormState = {
  ...EMPTY_TRANSFER_FORM,
  amount: '500',
  firstName: 'Alex',
  lastName: 'Grey',
  accountNumber: '123456789012',
  routingNumber: '026073150',
  addressLine1: '123 Main Street',
  city: 'New York',
  state: 'NY',
  zipCode: '10001',
  country: 'US',
};

const sepa = (overrides: Partial<WirexTransferFormState> = {}) =>
  validateTransferForm(WirexBankAccountType.SEPA, { ...validSepa, ...overrides });

const ach = (overrides: Partial<WirexTransferFormState> = {}) =>
  validateTransferForm(WirexBankAccountType.ACH, { ...validAch, ...overrides });

describe('validateTransferForm', () => {
  it('passes a complete SEPA form', () => {
    expect(sepa()).toEqual({});
  });

  it('passes a complete ACH form', () => {
    expect(ach()).toEqual({});
  });

  describe('amount', () => {
    it.each([
      ['', 'Enter an amount'],
      ['0', 'Enter an amount greater than zero'],
      ['-5', 'Enter an amount greater than zero'],
      ['abc', 'Enter an amount greater than zero'],
    ])('rejects %s', (amount, message) => {
      expect(sepa({ amount })).toMatchObject({ amount: message });
    });

    it('rejects sub-cent precision, which no bank rail carries', () => {
      expect(sepa({ amount: '10.123' })).toMatchObject({
        amount: expect.stringContaining('two decimal places'),
      });
    });

    it('accepts exactly two decimal places', () => {
      expect(sepa({ amount: '10.12' })).toEqual({});
    });
  });

  describe('recipient', () => {
    it('requires both names', () => {
      expect(sepa({ firstName: '' })).toHaveProperty('firstName');
      expect(sepa({ lastName: '' })).toHaveProperty('lastName');
    });

    it('rejects whitespace-only names rather than sending them', () => {
      expect(sepa({ firstName: '   ' })).toHaveProperty('firstName');
    });
  });

  describe('SEPA requisites', () => {
    it('requires an IBAN', () => {
      expect(sepa({ iban: '' })).toMatchObject({ iban: 'Enter an IBAN' });
    });

    /**
     * The case this validation exists for. Wirex accepts this IBAN, debits the
     * user, and the rail returns it days later — so it has to be stopped here.
     */
    it('rejects a checksum-invalid IBAN', () => {
      expect(sepa({ iban: 'DE89370400440532013001' })).toMatchObject({
        iban: expect.stringContaining('not valid'),
      });
    });

    it('accepts an IBAN pasted with the spacing a bank prints', () => {
      expect(sepa({ iban: 'DE89 3704 0044 0532 0130 00' })).toEqual({});
    });

    it('requires a BIC', () => {
      expect(sepa({ bic: '' })).toMatchObject({ bic: 'Enter a BIC' });
    });

    it('rejects a malformed BIC', () => {
      expect(sepa({ bic: 'COBA' })).toHaveProperty('bic');
    });

    it('rejects a BIC from a different country than the IBAN', () => {
      // Both individually valid; Wirex checks neither against the other.
      expect(sepa({ bic: 'BNPAFRPPXXX' })).toMatchObject({
        bic: expect.stringContaining('different country'),
      });
    });

    it('does not raise the country mismatch when the IBAN is itself invalid', () => {
      // Otherwise a bad IBAN produces two errors and the second is noise.
      const errors = sepa({ iban: 'DE89370400440532013001', bic: 'BNPAFRPPXXX' });
      expect(errors.iban).toBeDefined();
      expect(errors.bic).toBeUndefined();
    });
  });

  describe('ACH requisites', () => {
    it('rejects an account number outside 8-18 digits', () => {
      expect(ach({ accountNumber: '1234567' })).toHaveProperty('accountNumber');
      expect(ach({ accountNumber: '1234567890123456789' })).toHaveProperty('accountNumber');
    });

    it('rejects a routing number with a bad ABA check digit', () => {
      // Passes Wirex's own `^\d{9}$` rule.
      expect(ach({ routingNumber: '026073151' })).toHaveProperty('routingNumber');
    });

    it('requires the address Wirex demands on this rail', () => {
      expect(ach({ addressLine1: '' })).toHaveProperty('addressLine1');
      expect(ach({ city: '' })).toHaveProperty('city');
      expect(ach({ zipCode: '' })).toHaveProperty('zipCode');
    });

    it('requires a two-letter country code', () => {
      expect(ach({ country: 'USA' })).toHaveProperty('country');
      expect(ach({ country: '' })).toHaveProperty('country');
    });

    it('requires a state for US addresses', () => {
      expect(ach({ state: '' })).toMatchObject({
        state: expect.stringContaining('State is required'),
      });
    });

    it('does not require a state elsewhere', () => {
      expect(ach({ country: 'GB', state: '', zipCode: 'SW1A 2AA' })).toEqual({});
    });

    it('ignores SEPA fields entirely on this rail', () => {
      // A user who switched rails mid-form must not be blocked by a stale IBAN.
      expect(ach({ iban: 'nonsense', bic: 'nope' })).toEqual({});
    });
  });

  describe('reference', () => {
    it('accepts exactly the 140 characters Wirex allows', () => {
      expect(sepa({ reference: 'x'.repeat(140) })).toEqual({});
    });

    it('rejects 141', () => {
      expect(sepa({ reference: 'x'.repeat(141) })).toHaveProperty('reference');
    });
  });
});

describe('toEstimateRequest', () => {
  it('normalizes a spaced IBAN and BIC before they go on the wire', () => {
    const request = toEstimateRequest(WirexBankAccountType.SEPA, {
      ...validSepa,
      iban: 'de89 3704 0044 0532 0130 00',
      bic: 'coba deff xxx',
    });

    expect(request.recipientAccount).toEqual({
      iban: 'DE89370400440532013000',
      bic: 'COBADEFFXXX',
    });
  });

  it('sends the amount as a number, not the raw string', () => {
    expect(toEstimateRequest(WirexBankAccountType.SEPA, validSepa).amount).toBe(100);
  });

  it('trims the recipient name', () => {
    const request = toEstimateRequest(WirexBankAccountType.SEPA, {
      ...validSepa,
      firstName: '  Alex ',
      lastName: ' Grey  ',
    });
    expect(request.recipient).toEqual({ firstName: 'Alex', lastName: 'Grey' });
  });

  it('builds the ACH legal address Wirex requires', () => {
    const request = toEstimateRequest(WirexBankAccountType.ACH, validAch);

    expect(request.recipientAccount).toEqual({
      accountNumber: '123456789012',
      routingNumber: '026073150',
      legalAddress: {
        line1: '123 Main Street',
        city: 'New York',
        state: 'NY',
        zipCode: '10001',
        country: 'US',
      },
    });
  });

  it('upper-cases the country and strips separators from the numbers', () => {
    const request = toEstimateRequest(WirexBankAccountType.ACH, {
      ...validAch,
      accountNumber: '1234 5678 9012',
      routingNumber: '026-073-150',
      country: 'us',
      state: 'ny',
    });

    expect(request.recipientAccount).toMatchObject({
      accountNumber: '123456789012',
      routingNumber: '026073150',
      legalAddress: expect.objectContaining({ country: 'US', state: 'NY' }),
    });
  });

  it('omits `state` entirely when there is none, rather than sending empty', () => {
    const request = toEstimateRequest(WirexBankAccountType.ACH, {
      ...validAch,
      country: 'GB',
      state: '',
    });

    expect(request.recipientAccount.legalAddress).not.toHaveProperty('state');
  });

  it('omits an empty reference rather than sending a blank one', () => {
    expect(
      toEstimateRequest(WirexBankAccountType.SEPA, {
        ...validSepa,
        reference: '   ',
      }),
    ).not.toHaveProperty('reference');
  });

  it('includes a trimmed reference when there is one', () => {
    expect(
      toEstimateRequest(WirexBankAccountType.SEPA, {
        ...validSepa,
        reference: '  Invoice 12345  ',
      }).reference,
    ).toBe('Invoice 12345');
  });

  it('never sends SEPA fields on the ACH rail, or the reverse', () => {
    const achRequest = toEstimateRequest(WirexBankAccountType.ACH, validAch);
    expect(achRequest.recipientAccount).not.toHaveProperty('iban');
    expect(achRequest.recipientAccount).not.toHaveProperty('bic');

    const sepaRequest = toEstimateRequest(WirexBankAccountType.SEPA, validSepa);
    expect(sepaRequest.recipientAccount).not.toHaveProperty('accountNumber');
    expect(sepaRequest.recipientAccount).not.toHaveProperty('legalAddress');
  });
});
