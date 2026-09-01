/**
 * Client-side IBAN / BIC / ABA checks.
 *
 * The backend validates all of this too, and its answer is authoritative — this
 * exists so a mistyped digit is caught as the user types rather than after a
 * round trip. Both layers matter: Wirex validates *format only* and accepts a
 * bad-checksum IBAN, which is then debited from the user and returned by the
 * rail days later.
 *
 * Kept deliberately small and dependency-free; the server owns the exhaustive
 * per-country rules.
 */

/** Wirex's format rule: `^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$`. */
const IBAN_FORMAT = /^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/;

/** Wirex's format rule: `^[A-Z]{4}[A-Z]{2}[A-Z0-9]{2}([A-Z0-9]{3})?$`. */
const BIC_FORMAT = /^[A-Z]{4}[A-Z]{2}[A-Z0-9]{2}([A-Z0-9]{3})?$/;

/**
 * Separators stripped before comparing.
 *
 * `\s` covers the ordinary cases; U+00A0, U+2009 and U+202F are what a bank
 * statement PDF puts between the groups of four and survive a copy-paste.
 * Written as escapes so they are visible in review.
 */
const SEPARATORS = /[\s\u00a0\u2009\u202f-]/g;

/** Strip formatting and upper-case an IBAN or BIC. */
export function normalizeIban(raw: string): string {
  return raw.replace(SEPARATORS, '').toUpperCase();
}

/**
 * ISO 7064 MOD-97-10, computed nine digits at a time so it never needs BigInt.
 *
 * The rearranged, letter-expanded string runs to ~38 digits — past Number's
 * exact range — so the remainder is carried in chunks instead.
 */
function mod97(iban: string): number {
  const rearranged = iban.slice(4) + iban.slice(0, 4);
  let remainder = 0;
  let chunk = '';

  for (const char of rearranged) {
    const code = char.charCodeAt(0);
    // '0'-'9' pass through; 'A'-'Z' become 10-35.
    chunk += code >= 48 && code <= 57 ? char : String(code - 55);
    if (chunk.length >= 9) {
      remainder = Number(`${remainder}${chunk}`) % 97;
      chunk = '';
    }
  }

  return chunk ? Number(`${remainder}${chunk}`) % 97 : remainder;
}

/** Whether an IBAN is structurally valid and passes its check digits. */
export function isValidIban(raw: string | undefined | null): boolean {
  const value = normalizeIban(raw ?? '');
  return IBAN_FORMAT.test(value) && mod97(value) === 1;
}

/** Whether a BIC is well-formed, optionally agreeing with an IBAN's country. */
export function isValidBic(raw: string | undefined | null, ibanCountry?: string): boolean {
  const value = normalizeIban(raw ?? '');
  if (!BIC_FORMAT.test(value)) return false;
  // Characters 5-6 are the BIC's own ISO 3166-1 country; a disagreement means
  // one of the two was pasted from the wrong account.
  return !ibanCountry || value.slice(4, 6) === ibanCountry.toUpperCase();
}

/** The IBAN's country prefix, or undefined when it has none. */
export function ibanCountry(raw: string | undefined | null): string | undefined {
  const value = normalizeIban(raw ?? '');
  return value.length >= 2 ? value.slice(0, 2) : undefined;
}

/**
 * ABA routing check digit (ANSI X9.9): the 3-7-1 weighted sum of the nine
 * digits must be ≡ 0 (mod 10).
 */
export function isValidRoutingNumber(raw: string | undefined | null): boolean {
  const value = (raw ?? '').replace(SEPARATORS, '');
  if (!/^\d{9}$/.test(value)) return false;
  const weights = [3, 7, 1, 3, 7, 1, 3, 7, 1];
  const sum = weights.reduce((total, weight, index) => total + weight * Number(value[index]), 0);
  return sum % 10 === 0;
}

/** Whether an ACH account number is the 8-18 digits Wirex requires. */
export function isValidBankAccountNumber(raw: string | undefined | null): boolean {
  return /^\d{8,18}$/.test((raw ?? '').replace(SEPARATORS, ''));
}

/** Group an IBAN in fours for display: "DE89 3704 0044 0532 0130 00". */
export function formatIban(raw: string | undefined | null): string {
  return (normalizeIban(raw ?? '').match(/.{1,4}/g) ?? []).join(' ');
}
