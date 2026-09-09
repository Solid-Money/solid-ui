/**
 * Minimum savings (soUSD) a card applicant must deposit — and still be holding —
 * before their application is submitted, in USD.
 *
 * Every applicant on the Rain flow costs real cash before they are worth
 * anything: ~$1 for the Didit verification and ~$2.50 for Rain's own KYC. The
 * gate exists so those fees are only spent on someone who has actually funded an
 * account.
 *
 * This started at $5 for Bangladesh alone, where cards were being issued to
 * users who never funded them. It is now $10 and applies to every Rain
 * applicant, everywhere — see `requiresCardDeposit`.
 *
 * The backend serves the same figure on `/cards/status.minimumDepositUsd` and
 * is what actually enforces it; this is the fallback for the screens that render
 * before a card status exists.
 */
export const MINIMUM_CARD_DEPOSIT_USD = 10;

/**
 * Slack allowed below {@link MINIMUM_CARD_DEPOSIT_USD} when checking a held
 * soUSD position against it.
 *
 * Someone who sends exactly $10 lands slightly short: the on-ramp or bridge
 * takes its cut, and the position is then valued by multiplying vault shares by
 * the accountant rate, which rounds. Without a tolerance those users sit a few
 * cents under the bar with no way to see why. Deliberately small — this absorbs
 * pricing noise, not a materially smaller deposit. Mirrors
 * `CARD_DEPOSIT_TOLERANCE_USD` on the backend, which is the enforcing side.
 */
export const CARD_DEPOSIT_TOLERANCE_USD = 0.5;

/** {@link MINIMUM_CARD_DEPOSIT_USD} in cents (Rain reports collateral in cents). */
export const MINIMUM_CARD_DEPOSIT_CENTS = MINIMUM_CARD_DEPOSIT_USD * 100;
