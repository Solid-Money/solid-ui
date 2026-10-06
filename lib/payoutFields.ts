import type { TransfiPayoutField } from '@/lib/types';

/**
 * Client copy of the backend's payout-field rules (transfi-cashout.util.ts).
 * The server re-checks everything; this exists so a mistyped IBAN is caught as
 * the user types rather than after they confirm. Keep the two in step.
 */

const PHONE_KEY = /phone|mobile|msisdn/i;
const COMPACT_UPPER_KEY = /^(iban|bic|swift|swiftCode|bicSwift|ifsc|ifscCode)$/i;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Canonical form: IBAN/BIC without spaces in capitals, phones without separators. */
export const normalisePayoutValue = (key: string, value: unknown): string => {
  const text = value == null ? '' : String(value).trim();
  if (COMPACT_UPPER_KEY.test(key)) return text.replace(/\s+/g, '').toUpperCase();
  if (PHONE_KEY.test(key)) return text.replace(/[\s\-().]/g, '');
  return text;
};

const compile = (pattern: string): RegExp | undefined => {
  try {
    return new RegExp(pattern);
  } catch {
    return undefined;
  }
};

/** The problem with one field's value, or undefined when it is fine. */
export const validatePayoutField = (
  field: TransfiPayoutField,
  raw: unknown,
): string | undefined => {
  const value = normalisePayoutValue(field.key, field.locked && field.value ? field.value : raw);
  if (!value) return field.required ? `${field.label} is required` : undefined;
  if (field.minLength != null && value.length < field.minLength) {
    return `${field.label} must be at least ${field.minLength} characters`;
  }
  if (field.maxLength != null && value.length > field.maxLength) {
    return `${field.label} must be at most ${field.maxLength} characters`;
  }
  if (field.type === 'select' && field.options && !field.options.some(o => o.value === value)) {
    return `Choose a ${field.label.toLowerCase()} from the list`;
  }
  if (field.type === 'email' && !EMAIL_PATTERN.test(value))
    return `${field.label} doesn’t look right`;
  if (field.type === 'number' && !Number.isFinite(Number(value))) {
    return `${field.label} must be a number`;
  }
  if (field.pattern) {
    const pattern = compile(field.pattern);
    if (pattern && !pattern.test(value)) return `${field.label} doesn’t look right`;
  }
  return undefined;
};

/** Normalised values for every field, plus the problems keyed by field. */
export const validatePayoutDetails = (
  fields: TransfiPayoutField[],
  submitted: Record<string, string>,
): { values: Record<string, string>; errors: Record<string, string> } => {
  const values: Record<string, string> = {};
  const errors: Record<string, string> = {};
  for (const field of fields) {
    const raw = field.locked && field.value ? field.value : submitted[field.key];
    const error = validatePayoutField(field, raw);
    if (error) errors[field.key] = error;
    const value = normalisePayoutValue(field.key, raw);
    if (value) values[field.key] = value;
  }
  return { values, errors };
};

/** Starting values for a method's form: whatever the profile pre-filled. */
export const initialPayoutValues = (fields: TransfiPayoutField[]): Record<string, string> =>
  Object.fromEntries(
    fields.filter(field => field.value).map(field => [field.key, field.value as string]),
  );

const ACCOUNT_IDENTIFIER_KEYS = [
  'iban',
  'accountNumber',
  'bankAccountNumber',
  'clabe',
  'cbu',
  'cvu',
  'pixKey',
  'upiId',
  'walletId',
  'phoneNumber',
  'mobileNumber',
  'phone',
  'msisdn',
];

/** "SEPA Instant •• 7034" — the destination with only its last four characters. */
export const maskPayoutDestination = (
  methodName: string | undefined,
  values: Record<string, string>,
): string => {
  const key = ACCOUNT_IDENTIFIER_KEYS.find(candidate => values[candidate]);
  const tail = key ? `•• ${values[key].slice(-4)}` : '';
  return [methodName, tail].filter(Boolean).join(' ') || 'Bank account';
};

/** The account holder's name, from whichever identity fields the method has. */
export const payoutHolderName = (values: Record<string, string>): string | undefined => {
  const full =
    values.accountHolderName ??
    values.beneficiaryName ??
    values.accountName ??
    values.fullName ??
    values.name;
  if (full) return full;
  const joined = [values.firstName, values.lastName].filter(Boolean).join(' ');
  return joined || undefined;
};
