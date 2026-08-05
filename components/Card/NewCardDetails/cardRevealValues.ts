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
 * Stand-in values used when the reveal request fails, so the flip + slide-down
 * still play and the screen can be inspected. These are the literal placeholders
 * from the Figma reveal frame (21742:4077).
 */
const DUMMY = {
  number: '6483',
  expiry: '12/27',
  cvv: '234',
  nameOnCard: 'JOHN DOE',
  issuingCountry: 'Singapore',
};

/** Figma renders the number as four groups separated by three spaces. */
export const groupCardNumber = (cardNumber: string) =>
  cardNumber
    .replace(/\s+/g, '')
    .replace(/(.{4})/g, '$1   ')
    .trim();

const formatExpiry = (expiryDate: string) => {
  // Rain returns MM/YY directly; Bridge returns YYYY-MM-DD.
  if (/^\d{2}\/\d{2}$/.test(expiryDate)) return expiryDate;
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
 * Builds the values shown on the revealed card and in the panel. Anything the
 * backend couldn't supply falls back to the design's placeholder, so a failed
 * reveal still renders the designed layout instead of a dead spinner.
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
    number: numberPlain ? groupCardNumber(numberPlain) : groupCardNumber(DUMMY.number.repeat(4)),
    numberPlain: numberPlain || DUMMY.number.repeat(4),
    expiry: revealed?.expiry_date ? formatExpiry(revealed.expiry_date) : DUMMY.expiry,
    cvv: revealed?.card_security_code || DUMMY.cvv,
    nameOnCard: name || DUMMY.nameOnCard,
    issuingCountry: issuingCountry || DUMMY.issuingCountry,
  };
};
