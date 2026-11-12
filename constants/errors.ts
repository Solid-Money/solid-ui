import { ACCOUNT_SUSPENDED_MESSAGE, isAccountSuspendedError } from '@/lib/errors/accountSuspended';
import { getUserErrorMessage } from '@/lib/errors/classify';
export const ERRORS = {
  USERNAME_ALREADY_EXISTS: 'Username already exists',
  INVALID_INVITE_CODE: 'Invalid referral code',
  WAIT_TRANSACTION_RECEIPT: 'Error waiting for receipt',
  ERROR_SWITCHING_CHAIN: 'Error switching chain',
};

/**
 * Backend code for a login stamp Turnkey could not tie to any user — the passkey
 * is unknown to Turnkey (CREDENTIAL_NOT_FOUND) or its signature did not verify
 * (SIGNATURE_INVALID). Retrying with the same passkey cannot succeed.
 */
export const PASSKEY_NOT_REGISTERED_CODE = 'PASSKEY_NOT_REGISTERED';

/**
 * Backend code for a login stamp Turnkey *did* authenticate, against a
 * sub-organization no Solid account claims.
 *
 * Signup creates the passkey before the sub-organization and the sub-organization
 * before the account row, so a failure part-way through leaves a credential in
 * the keychain that passes Face ID forever and can never sign in.
 */
export const PASSKEY_ACCOUNT_NOT_FOUND_CODE = 'PASSKEY_ACCOUNT_NOT_FOUND';

/**
 * Backend code for a signup, or an email change, on a domain on the
 * anti-abuse blocklist (throwaway inboxes used by account farms). Retrying
 * with the same address cannot succeed; another address can.
 */
export const EMAIL_DOMAIN_NOT_ALLOWED_CODE = 'EMAIL_DOMAIN_NOT_ALLOWED';

/**
 * Backend code when it couldn't verify that a recovery, signup or email-change
 * request came from the real app or a real browser (App Check / Turnstile, see
 * lib/botProtection.ts). Usually an outdated build, or a page blocking the
 * Turnstile script; updating or refreshing fixes it.
 */
export const BOT_CHECK_FAILED_CODE = 'BOT_CHECK_FAILED';
export const BOT_CHECK_FAILED_MESSAGE =
  'We couldn’t verify this device. Update the app or refresh the page, then try again.';

/** An email change to an address another account already holds. */
export const EMAIL_ALREADY_LINKED_CODE = 'EMAIL_ALREADY_LINKED';
export const EMAIL_ALREADY_LINKED_MESSAGE =
  'This email is already linked to another account. Use a different email.';

/**
 * Whether an API error is a rate limit. The backend answers 429 with its own
 * wording; older checks only matched Turnkey's phrasing.
 */
export const isRateLimitedError = (error: unknown): boolean => {
  const err = error as { status?: unknown; statusCode?: unknown } | null;
  return err?.statusCode === 429 || err?.status === 429;
};

/**
 * The email change reached the backend without a valid passkey confirmation —
 * or the verified code it belonged to has expired or was already used. The
 * user has to request a new code.
 */
export const EMAIL_CHANGE_STEP_UP_REQUIRED_CODE = 'EMAIL_CHANGE_STEP_UP_REQUIRED';

/** Turnkey did not accept the passkey's signature for the email change. */
export const EMAIL_CHANGE_CONFIRM_FAILED_CODE = 'EMAIL_CHANGE_CONFIRM_FAILED';

export const EMAIL_DOMAIN_NOT_ALLOWED_MESSAGE =
  "This email provider isn't supported. Please use a different email address.";

/**
 * Backend code for an unfreeze the cardholder asked for on a card Solid (or the
 * issuer) froze. Only support can lift it.
 */
export const CARD_FROZEN_BY_SOLID_CODE = 'CARD_FROZEN_BY_SOLID';

export const CARD_FROZEN_BY_SOLID_MESSAGE =
  "Your card was frozen by Solid and can't be unfrozen from the app. Please contact support.";

/**
 * Our own copy for a 404 that arrives without a `code` — an older backend, which
 * answered both cases above with a bare "User not found". Shown instead of that
 * text because the account usually is not missing: it is the passkey that isn't
 * on it, and "User not found" reads as "your money is gone".
 */
export const PASSKEY_UNLINKED_MESSAGE =
  'This passkey is not linked to a Solid account. If you already have an account, ' +
  'recover it to add this device.';

const UNLINKED_PASSKEY_CODES: string[] = [
  PASSKEY_NOT_REGISTERED_CODE,
  PASSKEY_ACCOUNT_NOT_FOUND_CODE,
];

/**
 * Whether a failed login means "the passkey that just signed cannot reach an
 * account", as opposed to a cancelled prompt, a network failure or a closed
 * account.
 *
 * Both shapes are a 404 from `/auths/log-in`, and both share the same two facts:
 * retrying with this passkey cannot succeed, and the way out is recovery — not
 * signup, which refuses the user's own email as already registered.
 */
export const isUnlinkedPasskeyError = (error: unknown): boolean => {
  const err = error as { code?: unknown; status?: unknown; statusCode?: unknown } | null;
  if (!err) return false;

  if (typeof err.code === 'string' && UNLINKED_PASSKEY_CODES.includes(err.code)) return true;

  // An older backend answers untyped. `statusCode` is set alongside `status`
  // only by this app's own ApiError — the shape the login call throws — so
  // requiring both keeps a 404 from elsewhere in the login sequence (viem
  // reaching an RPC host, say) from being read as "your passkey has no account".
  return err.status === 404 && err.statusCode === 404;
};

/**
 * The copy to show for a failed login, derived from the error `handleLogin`
 * re-throws.
 *
 * Deliberately the only place that decides it. `handleLogin` re-throws the
 * original error so callers keep its `status` and `code`, which means every
 * caller holds a raw API message alongside the sanitized one — and reading
 * `error.message` for the toast is how "User not found", the bare 404 of a
 * backend that predates the codes above and the exact phrasing this exists to
 * keep off the screen, reached the user anyway.
 */
export const loginErrorMessage = (error: unknown): string => {
  const err = error as { name?: unknown; code?: unknown; message?: unknown } | null;
  const message = typeof err?.message === 'string' ? err.message : '';

  // WebAuthn reports a dismissed prompt as a failure; the platform's wording for
  // it describes the machinery, not the thing the user just chose to do.
  if (err?.name === 'NotAllowedError') return 'User cancelled login';

  // An admin suspended the account: signing in again cannot help, support can.
  if (isAccountSuspendedError(error)) return ACCOUNT_SUSPENDED_MESSAGE;

  if (isUnlinkedPasskeyError(error)) {
    // A typed reply names which flavour it is, and its copy is the precise one.
    return typeof err?.code === 'string' && message ? message : PASSKEY_UNLINKED_MESSAGE;
  }

  // Anything else gets user copy: a raw message here has been a bare backend
  // 404 or an SDK stack, never something to show.
  return getUserErrorMessage(error, { action: 'sign_in' }) || 'Something went wrong. Try again.';
};
