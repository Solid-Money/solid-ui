import {
  formatIban,
  ibanCountry,
  isValidBankAccountNumber,
  isValidBic,
  isValidIban,
  isValidRoutingNumber,
  normalizeIban,
} from '@/lib/utils/iban';

/**
 * These run client-side purely so a typo is caught as the user types. The
 * backend repeats every one of them and its answer is authoritative — but
 * neither layer is decorative, because Wirex validates *format only*:
 *
 * > "IBAN and card number checksums are not validated. Only the format is
 * >  checked, so a format-valid IBAN with a bad check digit passes here and is
 * >  rejected by the rail after the transfer is accepted."
 *
 * A gap therefore does not surface as a 400. It surfaces as an accepted
 * transfer that debits the user and bounces days later.
 */
describe('iban', () => {
  describe('isValidIban', () => {
    it.each([
      'DE89370400440532013000',
      'GB82WEST12345698765432',
      'FR1420041010050500013M02606',
      'NL91ABNA0417164300',
      'ES9121000418450200051332',
      'IT60X0542811101000000123456',
      'NO9386011117947',
      'CH9300762011623852957',
      'MT84MALT011000012345MTLCAST001S',
    ])('accepts the real IBAN %s', iban => {
      expect(isValidIban(iban)).toBe(true);
    });

    it.each([
      // Check digits transposed.
      'DE98370400440532013000',
      // One digit changed in the BBAN.
      'DE89370400440532013001',
      // Two adjacent digits swapped.
      'DE89370400440532010300',
    ])('rejects the format-valid but checksum-invalid %s', iban => {
      // Every one of these passes Wirex's own regex.
      expect(isValidIban(iban)).toBe(false);
    });

    it('accepts an IBAN pasted the way a bank prints it', () => {
      expect(isValidIban('DE89 3704 0044 0532 0130 00')).toBe(true);
    });

    it('accepts a lower-cased IBAN', () => {
      expect(isValidIban('de89370400440532013000')).toBe(true);
    });

    it.each(['', 'NOT-AN-IBAN', 'DEAB370400440532013000', 'DE8937040'])(
      'rejects the malformed %s',
      iban => {
        expect(isValidIban(iban)).toBe(false);
      },
    );

    it('does not throw on null or undefined', () => {
      expect(isValidIban(undefined)).toBe(false);
      expect(isValidIban(null)).toBe(false);
    });

    it('handles the longest registered IBAN without precision loss', () => {
      // 31 characters — a naive Number() parse would lose precision first.
      expect(isValidIban('MT84MALT011000012345MTLCAST001S')).toBe(true);
      expect(isValidIban('MT85MALT011000012345MTLCAST001S')).toBe(false);
    });
  });

  describe('isValidBic', () => {
    it.each(['COBADEFFXXX', 'WESTGB2L', 'DEUTDEFF'])('accepts %s', bic => {
      expect(isValidBic(bic)).toBe(true);
    });

    it.each(['', 'COBA', 'COBADEFFX', '1OBADEFFXXX'])('rejects %s', bic => {
      expect(isValidBic(bic)).toBe(false);
    });

    it('rejects a BIC whose country disagrees with the IBAN', () => {
      // Both are individually valid; Wirex checks neither against the other.
      expect(isValidBic('BNPAFRPPXXX', 'DE')).toBe(false);
    });

    it('accepts a BIC that agrees with the IBAN country', () => {
      expect(isValidBic('COBADEFFXXX', 'DE')).toBe(true);
    });
  });

  describe('ibanCountry', () => {
    it('reads the country prefix', () => {
      expect(ibanCountry('DE89 3704 0044 0532 0130 00')).toBe('DE');
      expect(ibanCountry('gb82west12345698765432')).toBe('GB');
    });

    it('is undefined for a value too short to have one', () => {
      expect(ibanCountry('D')).toBeUndefined();
      expect(ibanCountry('')).toBeUndefined();
    });
  });

  describe('isValidRoutingNumber', () => {
    it.each(['026073150', '021000021', '011401533', '121000248'])(
      'accepts the real routing number %s',
      routing => {
        expect(isValidRoutingNumber(routing)).toBe(true);
      },
    );

    it('rejects nine digits with a wrong check digit', () => {
      // Passes Wirex's `^\d{9}$` rule; fails the ABA 3-7-1 weighting.
      expect(isValidRoutingNumber('026073151')).toBe(false);
    });

    it.each(['', '12345678', '1234567890', 'abcdefghi'])('rejects %s on format', routing => {
      expect(isValidRoutingNumber(routing)).toBe(false);
    });

    it('tolerates separators a user may paste', () => {
      expect(isValidRoutingNumber('026-073-150')).toBe(true);
    });
  });

  describe('isValidBankAccountNumber', () => {
    it.each(['12345678', '123456789012', '123456789012345678'])('accepts %s', value => {
      expect(isValidBankAccountNumber(value)).toBe(true);
    });

    it.each(['1234567', '1234567890123456789', '1234abcd', ''])('rejects %s', value => {
      expect(isValidBankAccountNumber(value)).toBe(false);
    });
  });

  describe('formatting', () => {
    it('normalizes away spacing and case', () => {
      expect(normalizeIban(' de89 3704 0044 ')).toBe('DE8937040044');
    });

    it('groups an IBAN in fours for display', () => {
      expect(formatIban('DE89370400440532013000')).toBe('DE89 3704 0044 0532 0130 00');
    });

    it('returns an empty string rather than throwing on nothing', () => {
      expect(formatIban(undefined)).toBe('');
    });
  });
});
