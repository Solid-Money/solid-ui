import { COUNTRIES } from '@/constants/countries';
import { CardDetailsRevealResponse, CardHolderName } from '@/lib/types';

export interface CardRevealValues {
  /** Card number, already grouped for display. */
  number: string;
  /** Raw digits, for the clipboard. */
  numberPlain: string;
  expiry: string;
  cvv: string;
  nameOnCard: string;
  issuingCountry: string;
}

/**
 * Masks shown when a value is genuinely unavailable.
 *
 * These used to be the literal placeholders from the Figma reveal frame
 * (6483 6483 6483 6483, 12/27, 234, JOHN DOE) so the flip still played on a
 * failed reveal. That rendered a plausible-looking card the user could try to
 * type into a checkout, and read as the feature working when it had not — the
 * reveal must never invent card data. Masks are unmistakably not data, and a
 * failed reveal now surfaces the error instead of flipping the card.
 */
const MASK = {
  numberGroup: '••••',
  expiry: '••/••',
  cvv: '•••',
  nameOnCard: '',
  issuingCountry: '',
};

/**
 * Country name for an ISO 3166-1 **alpha-2** code, for the "issuing country" row.
 *
 * Normalises case before matching: COUNTRIES is keyed on upper-case alpha-2, and
 * an exact comparison silently blanked the row whenever the backend sent a
 * differently-cased code. Alpha-3 cannot be resolved here — there is no 3→2 table
 * on the client — so the backend is responsible for emitting alpha-2, and an
 * unresolvable code yields undefined rather than a wrong country.
 */
export const resolveIssuingCountryName = (code?: string | null): string | undefined => {
  const normalised = code?.trim().toUpperCase();
  if (!normalised) return undefined;
  return COUNTRIES.find(country => country.code === normalised)?.name;
};

/** Figma renders the number as four groups separated by three spaces. */
export const groupCardNumber = (cardNumber: string) =>
  cardNumber
    .replace(/\s+/g, '')
    .replace(/(.{4})/g, '$1   ')
    .trim();

const formatExpiry = (expiryDate: string) => {
  // Rain returns MM/YY directly.
  if (/^\d{2}\/\d{2}$/.test(expiryDate)) return expiryDate;
  // Wirex returns MM/YYYY. `new Date('12/2027')` is not reliably parseable, so
  // truncate the century rather than routing it through Date.
  const monthYear = /^(\d{2})\/\d{2}(\d{2})$/.exec(expiryDate);
  if (monthYear) return `${monthYear[1]}/${monthYear[2]}`;
  // Bridge returns YYYY-MM-DD.
  const date = new Date(expiryDate);
  if (Number.isNaN(date.getTime())) return expiryDate;
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const year = date.getFullYear().toString().slice(-2);
  return `${month}/${year}`;
};

interface ResolveArgs {
  revealed: CardDetailsRevealResponse | null;
  cardholderName?: CardHolderName;
  issuingCountry?: string;
}

/**
 * Builds the values shown on the revealed card and in the panel.
 *
 * Anything the issuer didn't supply renders as a mask, never as invented data —
 * `numberPlain` stays empty in that case so a copy action cannot put a
 * made-up card number on the clipboard.
 */
export const resolveCardRevealValues = ({
  revealed,
  cardholderName,
  issuingCountry,
}: ResolveArgs): CardRevealValues => {
  const numberPlain = revealed?.card_number?.replace(/\s+/g, '') ?? '';
  const name = cardholderName
    ? `${cardholderName.first_name} ${cardholderName.last_name}`.trim().toUpperCase()
    : '';

  return {
    number: numberPlain
      ? groupCardNumber(numberPlain)
      : Array(4).fill(MASK.numberGroup).join('   '),
    // Deliberately empty rather than masked: this is what gets copied.
    numberPlain,
    expiry: revealed?.expiry_date ? formatExpiry(revealed.expiry_date) : MASK.expiry,
    cvv: revealed?.card_security_code || MASK.cvv,
    nameOnCard: name || MASK.nameOnCard,
    issuingCountry: issuingCountry || MASK.issuingCountry,
  };
};
