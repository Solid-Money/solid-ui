/**
 * Residence country (ISO 3166-1 alpha-2) whose users must fund their card with
 * a minimum collateral deposit before they can spend. Bangladesh users were
 * issuing cards without ever funding them (costing us card-creation fees), so
 * the issuance flow now blocks on a minimum deposit for this country.
 */
export const CARD_DEPOSIT_REQUIRED_COUNTRY = 'BD';

/** Minimum collateral a {@link CARD_DEPOSIT_REQUIRED_COUNTRY} user must deposit, in USD. */
export const MINIMUM_CARD_DEPOSIT_USD = 5;

/** {@link MINIMUM_CARD_DEPOSIT_USD} in cents (Rain reports collateral in cents). */
export const MINIMUM_CARD_DEPOSIT_CENTS = MINIMUM_CARD_DEPOSIT_USD * 100;
