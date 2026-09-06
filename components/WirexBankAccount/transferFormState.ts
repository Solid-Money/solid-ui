/**
 * Form state, validation and request shaping for an outbound Wirex transfer.
 *
 * Deliberately free of React and UI imports so it can be unit-tested on its own
 * — importing the component would drag in the whole `@/lib/utils` barrel and,
 * through it, wagmi's ESM build, which Jest cannot parse. Same split as
 * cardRevealValues.ts beside the card details screen.
 */
import {
  WirexBankAccountType,
  WirexBankTransferEstimateRequest,
  WirexRecipientAccountInput,
} from '@/lib/types/wirex-bank';
import {
  ibanCountry,
  isValidBankAccountNumber,
  isValidBic,
  isValidIban,
  isValidRoutingNumber,
  normalizeIban,
} from '@/lib/utils/iban';

/** Wirex caps the payment reference at 140 characters. */
export const REFERENCE_MAX_LENGTH = 140;

/**
 * A plain decimal with at most two places — the precision every bank rail
 * carries.
 *
 * Matched against the typed string rather than computed from the parsed number.
 * The obvious `Math.round(amount * 100) !== amount * 100` check is wrong for
 * ordinary inputs: `10.12 * 100` is `1011.9999999999999` in IEEE-754, so it
 * would reject an amount a user is perfectly entitled to send.
 */
const AMOUNT_FORMAT = /^\d+(\.\d{1,2})?$/;

/** Everything the form collects, before it is shaped into an API request. */
export interface WirexTransferFormState {
  amount: string;
  firstName: string;
  lastName: string;
  /** SEPA. */
  iban: string;
  /** SEPA. */
  bic: string;
  /** ACH. */
  accountNumber: string;
  /** ACH. */
  routingNumber: string;
  /** ACH. */
  addressLine1: string;
  /** ACH. */
  city: string;
  /** ACH — required when `country` is US. */
  state: string;
  /** ACH. */
  zipCode: string;
  /** ACH — ISO 3166-1 alpha-2. */
  country: string;
  reference: string;
}

export const EMPTY_TRANSFER_FORM: WirexTransferFormState = {
  amount: '',
  firstName: '',
  lastName: '',
  iban: '',
  bic: '',
  accountNumber: '',
  routingNumber: '',
  addressLine1: '',
  city: '',
  state: '',
  zipCode: '',
  country: '',
  reference: '',
};

/** Per-field messages, keyed by the field they belong under. */
export type WirexTransferFormErrors = Partial<Record<keyof WirexTransferFormState, string>>;

/**
 * Validate the form for one rail.
 *
 * Mirrors the server's checks — including the IBAN checksum and the ABA check
 * digit, which Wirex itself does not verify — so a typo is caught before a
 * round trip rather than after one. The server remains authoritative.
 */
export function validateTransferForm(
  accountType: WirexBankAccountType,
  form: WirexTransferFormState,
): WirexTransferFormErrors {
  const errors: WirexTransferFormErrors = {};

  const rawAmount = form.amount.trim();
  const amount = Number(rawAmount);
  if (!rawAmount) {
    errors.amount = 'Enter an amount';
  } else if (!Number.isFinite(amount) || amount <= 0) {
    errors.amount = 'Enter an amount greater than zero';
  } else if (!AMOUNT_FORMAT.test(rawAmount)) {
    errors.amount = 'Amounts can have at most two decimal places';
  }

  if (!form.firstName.trim()) errors.firstName = "Enter the recipient's first name";
  if (!form.lastName.trim()) errors.lastName = "Enter the recipient's last name";

  if (accountType === WirexBankAccountType.SEPA) {
    if (!form.iban.trim()) {
      errors.iban = 'Enter an IBAN';
    } else if (!isValidIban(form.iban)) {
      // Wirex would accept this and the rail would bounce it days later.
      errors.iban = 'This IBAN is not valid — please re-check it';
    }

    if (!form.bic.trim()) {
      errors.bic = 'Enter a BIC';
    } else if (!isValidBic(form.bic)) {
      errors.bic = 'A BIC is 8 or 11 letters and digits';
    } else if (isValidIban(form.iban) && !isValidBic(form.bic, ibanCountry(form.iban))) {
      errors.bic = 'This BIC is from a different country than the IBAN';
    }
  } else {
    if (!isValidBankAccountNumber(form.accountNumber)) {
      errors.accountNumber = 'An account number is 8 to 18 digits';
    }
    if (!isValidRoutingNumber(form.routingNumber)) {
      errors.routingNumber = 'This routing number is not valid';
    }
    if (!form.addressLine1.trim()) errors.addressLine1 = 'Enter a street address';
    if (!form.city.trim()) errors.city = 'Enter a city';
    if (!form.zipCode.trim()) errors.zipCode = 'Enter a postal code';

    const country = form.country.trim().toUpperCase();
    if (country.length !== 2) {
      errors.country = 'Enter a 2-letter country code';
    } else if (country === 'US' && !form.state.trim()) {
      // Wirex rejects a US address with no state; naming the field beats
      // surfacing their generic validation failure.
      errors.state = 'State is required for US addresses';
    }
  }

  if (form.reference.length > REFERENCE_MAX_LENGTH) {
    errors.reference = `References are at most ${REFERENCE_MAX_LENGTH} characters`;
  }

  return errors;
}

/** Shape a validated form into the estimate request the API takes. */
export function toEstimateRequest(
  accountType: WirexBankAccountType,
  form: WirexTransferFormState,
): WirexBankTransferEstimateRequest {
  const recipientAccount: WirexRecipientAccountInput =
    accountType === WirexBankAccountType.SEPA
      ? { iban: normalizeIban(form.iban), bic: normalizeIban(form.bic) }
      : {
          accountNumber: form.accountNumber.replace(/\D/g, ''),
          routingNumber: form.routingNumber.replace(/\D/g, ''),
          legalAddress: {
            line1: form.addressLine1.trim(),
            city: form.city.trim(),
            ...(form.state.trim() ? { state: form.state.trim().toUpperCase() } : {}),
            zipCode: form.zipCode.trim(),
            country: form.country.trim().toUpperCase(),
          },
        };

  return {
    accountType,
    amount: Number(form.amount),
    recipient: {
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
    },
    recipientAccount,
    ...(form.reference.trim() ? { reference: form.reference.trim() } : {}),
  };
}
