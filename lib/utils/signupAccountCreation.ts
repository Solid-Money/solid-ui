/**
 * What a failed account creation needs from the person, at the last step of
 * signup.
 *
 * Every failure used to send them back to the passkey step to make another
 * passkey. That leaves the first one on their device, where it is offered at
 * every login and opens nothing, and it is wrong for most of the failures seen:
 * a dropped connection, a rate limit or an expired verification are all fixed
 * without a new passkey. Worse, when the account *was* created and only the
 * client's own wallet setup that follows failed (an RPC timeout), the next
 * attempt was refused with "Email already registered" and the person was stuck.
 *
 * Free of React Native imports so it can be unit-tested directly.
 */
import { PasskeyErrorSeverity } from '@/lib/utils/passkeyErrors';
import { isNetworkError } from '@/lib/utils/userFacingError';
import { isUsernameTakenError } from '@/lib/utils/username';

export type AccountCreationRecovery =
  /** Retry with the passkey already created. */
  | 'retry'
  /** The username was claimed meanwhile: choose another, keep the passkey. */
  | 'choose_username'
  /** The email verification is no longer valid: verify again, keep the passkey. */
  | 'verify_email'
  /** An account already exists for this email. */
  | 'log_in'
  /** The passkey never reached the server. */
  | 'new_passkey';

const statusOf = (error: unknown): number | undefined => {
  const { status, statusCode } = (error ?? {}) as { status?: unknown; statusCode?: unknown };
  if (typeof status === 'number') return status;
  if (typeof statusCode === 'number') return statusCode;
  return undefined;
};

const messageOf = (error: unknown): string => {
  const message = (error as { message?: unknown } | null)?.message;
  return typeof message === 'string' ? message : '';
};

export const getAccountCreationRecovery = (error: unknown): AccountCreationRecovery => {
  const status = statusOf(error);
  const message = messageOf(error);

  if (isUsernameTakenError(error)) return 'choose_username';
  if (status === 409 && /already registered/i.test(message)) return 'log_in';
  if (status === 401 && /verification token/i.test(message)) return 'verify_email';
  if (status === 400 && /passkey data is required/i.test(message)) return 'new_passkey';
  return 'retry';
};

/** The server's per-IP limit on account creation (3 a minute) answered. */
export const isRateLimitedError = (error: unknown): boolean =>
  statusOf(error) === 429 || /ThrottlerException|Too Many Requests/i.test(messageOf(error));

export const getAccountCreationStatus = statusOf;

/**
 * How loudly Sentry should hear about a failed account creation.
 *
 * Every one used to be an `error`. Only a failure the app or the server could
 * be at fault for still is: a server error, an unrecognised failure, or a
 * signup that reached the server without its passkey.
 */
export const getAccountCreationSeverity = (
  error: unknown,
  recovery: AccountCreationRecovery,
): PasskeyErrorSeverity => {
  switch (recovery) {
    // The server's rules doing their job, and the screen says what to do next.
    case 'choose_username':
    case 'log_in':
      return 'info';
    // Recoverable, but often enough would mean verifications expire too soon.
    case 'verify_email':
      return 'warning';
    case 'new_passkey':
      return 'error';
    default:
      // The connection, or the per-IP limit: neither is a fault to fix.
      return isRateLimitedError(error) || isNetworkError(error) ? 'warning' : 'error';
  }
};
