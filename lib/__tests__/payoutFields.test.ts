/// <reference types="jest" />

import {
  initialPayoutValues,
  maskPayoutDestination,
  normalisePayoutValue,
  payoutHolderName,
  validatePayoutDetails,
  validatePayoutField,
} from '@/lib/payoutFields';

import type { TransfiPayoutField } from '@/lib/types';

/** SEPA's fields as the backend hands them over, holder pre-filled and locked. */
const SEPA_FIELDS: TransfiPayoutField[] = [
  {
    key: 'firstName',
    label: 'First name',
    type: 'text',
    required: true,
    value: 'Alex',
    locked: true,
  },
  {
    key: 'lastName',
    label: 'Last name',
    type: 'text',
    required: true,
    value: 'Morgan',
    locked: true,
  },
  {
    key: 'iban',
    label: 'IBAN',
    type: 'text',
    required: true,
    minLength: 15,
    maxLength: 34,
    pattern: '^[A-Z]{2}[0-9]{2}[A-Z0-9]{1,30}$',
  },
  { key: 'city', label: 'City', type: 'text', required: true, value: 'Brussels' },
];

describe('payoutFields', () => {
  it('normalises IBANs and phone numbers the way TransFi expects', () => {
    expect(normalisePayoutValue('iban', 'be68 5390 0754 7034')).toBe('BE68539007547034');
    expect(normalisePayoutValue('phoneNumber', '+254 (712) 345-678')).toBe('+254712345678');
    expect(normalisePayoutValue('street', '  Rue Royale ')).toBe('Rue Royale');
  });

  it('accepts an IBAN typed with spaces in lower case', () => {
    expect(validatePayoutField(SEPA_FIELDS[2], 'be68 5390 0754 7034')).toBeUndefined();
  });

  it('explains what is wrong with a field', () => {
    expect(validatePayoutField(SEPA_FIELDS[2], '')).toBe('IBAN is required');
    expect(validatePayoutField(SEPA_FIELDS[2], 'BE68')).toBe('IBAN must be at least 15 characters');
    expect(validatePayoutField(SEPA_FIELDS[2], '1234567890123456')).toBe('IBAN doesn’t look right');
  });

  it('checks options and emails', () => {
    const bank: TransfiPayoutField = {
      key: 'bankCode',
      label: 'Bank code',
      type: 'select',
      required: true,
      options: [{ value: '044', label: 'Access Bank' }],
    };
    expect(validatePayoutField(bank, '999')).toBe('Choose a bank code from the list');
    expect(validatePayoutField(bank, '044')).toBeUndefined();

    const email: TransfiPayoutField = {
      key: 'email',
      label: 'Email',
      type: 'email',
      required: true,
    };
    expect(validatePayoutField(email, 'not-an-email')).toBe('Email doesn’t look right');
  });

  it('always uses the verified holder, whatever was typed', () => {
    const { values, errors } = validatePayoutDetails(SEPA_FIELDS, {
      firstName: 'Someone',
      iban: 'BE68539007547034',
      city: 'Brussels',
    });
    expect(errors).toEqual({});
    expect(values.firstName).toBe('Alex');
    expect(values.lastName).toBe('Morgan');
  });

  it('starts the form from the pre-filled values', () => {
    expect(initialPayoutValues(SEPA_FIELDS)).toEqual({
      firstName: 'Alex',
      lastName: 'Morgan',
      city: 'Brussels',
    });
  });

  it('masks the destination to its last four characters', () => {
    expect(maskPayoutDestination('SEPA Instant', { iban: 'BE68539007547034' })).toBe(
      'SEPA Instant •• 7034',
    );
    expect(maskPayoutDestination('M-Pesa', { phoneNumber: '+254712345678' })).toBe(
      'M-Pesa •• 5678',
    );
  });

  it('names the account holder from whichever fields the method has', () => {
    expect(payoutHolderName({ firstName: 'Alex', lastName: 'Morgan' })).toBe('Alex Morgan');
    expect(payoutHolderName({ accountHolderName: 'Alex Morgan' })).toBe('Alex Morgan');
    expect(payoutHolderName({})).toBeUndefined();
  });
});
